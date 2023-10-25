/*
EScript
Minimal object-oriented programming language designed to compile into JS

Syntax:

var := value;
mth(x, y) -> (result);
^ return;
((x, y) -> block);
selfMethod();
receiver method();
*/

class Reader {
    constructor (code) {
        this.code = code;
        this.i = 0;
    }
    
    peek (n = 1) {
        return this.code.slice(this.i, this.i + n);
    }
    read (n = 1) {
        const char = this.peek(n);
        this.i += n;
        return char;
    }
}

class Lexer {
    static alphabetics = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ_";
    static alphanumerics = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ_0123456789";
    static numerics = "0123456789";
    static numericsPlus = "0123456789e+x.";
    static operators = "+-*/%<=>&|";
    
    constructor (reader) { this.reader = reader; this.token = null; }
    
    skipWhitespace () {
        while (this.reader.peek() !== "" && (this.reader.peek() === "#" || this.reader.peek().trimStart().length === 0)) {
            if (this.reader.peek() === "#") {
                // Comment, skip to end of line
                while (this.reader.peek() !== "" && this.reader.peek() !== "\n") {
                    this.reader.read();
                }
            }
            
            this.reader.read();
        }
    }
    
    peek () {
        if (this.token) { return this.token };
        
        this.skipWhitespace();
        const char = this.reader.peek();
        
        if (char === "") {
            this.token = new EOFToken();
        } else if (char === ";") {
            this.reader.read();
            this.token = new SequenceToken();
        } else if (this.reader.peek(2) === "(|") {
            this.reader.read(2);
            this.token = new OpenObjectToken();
        } else if (this.reader.peek(2) === "|)") {
            this.reader.read(2);
            this.token = new CloseObjectToken();
        } else if (char === "(") {
            this.reader.read();
            this.token = new OpenExpressionToken();
        } else if (char === ")") {
            this.reader.read();
            this.token = new CloseExpressionToken();
        } else if (char === ",") {
            this.reader.read();
            this.token = new ArgSeparatorToken();
        } else if (char === "^") {
            this.reader.read();
            this.token = new ReturnToken();
        } else if (this.reader.peek() === "=" && !Lexer.operators.includes(this.reader.peek(2).at(1))) {
            this.reader.read();
            this.token = new AssignmentToken();
        } else if (this.reader.peek(2) === ":=") {
            this.reader.read(2);
            this.token = new PropertyDefToken();
        } else if (this.reader.peek(2) === "->") {
            this.reader.read(2);
            this.token = new MethodDefToken();
        } else if (char === "\"" || char === "'") {
            this.token = this.lexString(char);
        } else if (Lexer.numerics.includes(char) || (char === "-" || char === ".") && Lexer.numerics.includes(this.reader.peek(2).at(1))) {
            this.token = this.lexNumber();
        } else if (Lexer.operators.includes(char)) {
            this.token = this.lexOperator();
        } else if (Lexer.alphabetics.includes(char)) {
            this.token = this.lexIdentifier();
        }
        
        return this.token;
    }
    read () {
        const token = this.peek();
        this.token = null;
        return token;
    }
    
    lexString (quote) {
        let value = "";
        this.reader.read(); // Ignore opening quote
        
        while (this.reader.peek() !== "" && this.reader.peek() !== quote) {
            let char = this.reader.read();
            if (char === "\\") {
                char = this.reader.read();
            }
            value = value + char;
        }
        this.reader.read(); // Ignore closing quote
        
        return new LiteralToken(value);
    }
    lexNumber () {
        let value = this.reader.read();
        
        while (this.reader.peek() !== "" && Lexer.numericsPlus.includes(this.reader.peek())) {
            value = value + this.reader.read();
        }
        
        return new LiteralToken(+value);
    }
    lexIdentifier () {
        let name = "";
        
        while (this.reader.peek() !== "" && Lexer.alphanumerics.includes(this.reader.peek())) {
            name = name + this.reader.read();
        }
        
        return new IdentifierToken(name);
    }
    lexOperator () {
        let name = "";
        
        while (this.reader.peek() !== "" && Lexer.operators.includes(this.reader.peek())) {
            name = name + this.reader.read();
        }
        
        return new OperatorToken(name);
    }
}

class Parser {
    static cases = Object.create(null);
    
    constructor (lexer) {
        this.lexer = lexer;
        this.errorStack = [];
    }
    
    peek () { return this.lexer.peek(); }
    read () { return this.lexer.read(); }
    
    run () {
        try {
            return this.parse();
        } catch (message) {
            throw "Parsing error! After:\n\n\t" + this.errorStack[this.errorStack.length - 1] + "\n\n" + message;
        }
    }
    parse (precedence = 0) {
        let head;
        head = this.read().head(this);
        this.errorStack.push(head);
        
        while (this.peek().precedence > precedence) {
            head = this.read().tail(this, head);
            this.errorStack.pop();
            this.errorStack.push(head);
        }
        
        this.errorStack.pop();
        return head;
    }
}

/*
h, g; f := e = i & d > c + b * a method()
highest
N   method()
    * / %
    +
    < = >
    & |
    =
    := -> (right-associative)
    ;
    ,
    )
0   eof
lowest
*/

const PREC_HEADONLY = 11;
const PREC_METHOD = 10;
const PREC_PRODUCT = 9;
const PREC_SUM = 8;
const PREC_COMPR = 7;
const PREC_JUNCTION = 6;
const PREC_ASSIGNMENT = 5;
const PREC_DEFINITION = 4;
const PREC_SEQUENCE = 3;
const PREC_ARGSEP = 2;
const PREC_CLOSEEXPR = 1;
const PREC_EOF = 0;

class EOFToken {
    constructor () { this.precedence = PREC_EOF; }
}
class LiteralToken {
    constructor (value) { this.value = value; this.precedence = PREC_HEADONLY; }
    
    head (parser) {
        return new LiteralTerm(this.value);
    }
}
class IdentifierToken {
    constructor (name) {
        this.name = name;
        this.precedence = PREC_METHOD;
    }
    
    parseArgs (parser) {
        let args = [];
        const next = parser.peek();
        
        if (next instanceof OpenExpressionToken || next instanceof OpenObjectToken) {
            const arg = parser.parse(PREC_HEADONLY);
            if (arg instanceof TupleTerm) {
                args = arg.expressions;
            } else {
                args = [arg];
            }
        }
        
        return args;
    }
    
    head (parser) {
        return new IdentifierTerm(this.name, this.parseArgs(parser));
    }
    tail (parser, head) {
        return new CallTerm(head, this.name, this.parseArgs(parser));
    }
}
class OperatorToken {
    static junctions = "&|";
    static comparators = "<=>";
    static sums = "+-";
    
    constructor (name) {
        this.name = name;
        
        const initial = name.at(0);
        this.precedence = OperatorToken.junctions.includes(initial) ? PREC_JUNCTION : OperatorToken.comparators.includes(initial) ? PREC_COMPR : OperatorToken.sums.includes(initial) ? PREC_SUM : PREC_PRODUCT;
    }
    
    head (parser) {
        return new IdentifierTerm(this.name, [parser.parse(this.precedence)]);
    }
    tail (parser, head) {
        return new CallTerm(head, this.name, [parser.parse(this.precedence)]);
    }
}

class PropertyDefToken {
    constructor () { this.precedence = PREC_DEFINITION; }
    
    head (parser) {
        return new DelegateTerm(parser.parse(PREC_SEQUENCE));
    }
    tail (parser, head) {
        return new PropertyDefTerm(head, parser.parse(this.precedence - 1));
    }
}
class AssignmentToken {
    constructor () { this.precedence = PREC_ASSIGNMENT; }
    
    tail (parser, head) {
        // head should be SelfCall/Call term
        head.method = head.method + "=";
        
        if (parser.peek() instanceof OpenExpressionToken) {
            head.args.push(parser.parse(PREC_SEQUENCE));
        } else {
            head.args.push(parser.parse(this.precedence - 1));
        }
        
        return head;
    }
}
class MethodDefToken {
    constructor () { this.precedence = PREC_DEFINITION; }
    
    head (parser) {
        if (parser.peek().precedence < PREC_SEQUENCE) {
            return new LambdaTerm([], new TupleTerm());
        }
        return new LambdaTerm([], parser.parse(PREC_SEQUENCE - 1));
    }
    tail (parser, head) {
        if (head instanceof TupleTerm) {
            if (parser.peek().precedence < PREC_SEQUENCE) {
                return new LambdaTerm(head.expressions, new TupleTerm());
            }
            return new LambdaTerm(head.expressions, parser.parse(PREC_SEQUENCE - 1));
        }
        return new MethodDefTerm(head, parser.parse(this.precedence - 1));
    }
}
class OpenExpressionToken {
    constructor () { this.precedence = PREC_HEADONLY; }
    
    head (parser) {
        if (parser.peek().precedence <= PREC_CLOSEEXPR) {
            parser.read();
            return new TupleTerm();
        }
        
        const term = parser.parse(PREC_CLOSEEXPR);
        parser.read(); // Ignore closing parenthesis
        
        if (term instanceof TupleTerm) { return term; }
        return new TupleTerm(term);
    }
}
class CloseExpressionToken {
    constructor () { this.precedence = PREC_CLOSEEXPR; }
}
class OpenObjectToken {
    constructor () { this.precedence = PREC_HEADONLY; }
    
    head (parser) {
        if (parser.peek().precedence <= PREC_CLOSEEXPR) {
            parser.read();
            return new ObjectTerm(new TupleTerm());
        }
        
        const term = parser.parse(PREC_CLOSEEXPR);
        parser.read(); // Ignore closing object token
        return new ObjectTerm(term);
    }
}
class CloseObjectToken {
    constructor () { this.precedence = PREC_CLOSEEXPR; }
}
class ArgSeparatorToken {
    constructor () { this.precedence = PREC_ARGSEP; }
    
    tail (parser, head) {
        if (!parser.peek().head) {
            return head;
        }
        const rest = parser.parse(this.precedence - 1);
        
        if (rest instanceof TupleTerm) {
            rest.expressions.unshift(head);
            return rest;
        }
        
        return new TupleTerm(head, rest);
    }
}
class SequenceToken {
    constructor () { this.precedence = PREC_SEQUENCE; }
    
    tail (parser, head) {
        if (!parser.peek().head) {
            return head;
        }
        return new SequenceTerm(head, parser.parse(this.precedence - 1));
    }
}
class ReturnToken {
    constructor () { this.precedence = PREC_HEADONLY; }
    
    head (parser) {
        if (parser.peek().precedence <= PREC_SEQUENCE) {
            return new ReturnTerm(new TupleTerm());
        }
        
        const term = parser.parse(PREC_SEQUENCE);
        return new ReturnTerm(term);
    }
}

class LiteralTerm {
    constructor (value) {
        this.value = value;
    }
    
    step (frame) {
        vm.pop();
        vm.receive(wrap(this.value));
    }
    
    toString() {
        if (typeof this.value === "string") { return "\"" + this.value + "\"" };
        return this.value;
    }
}
class IdentifierTerm {
    constructor (method, args) {
        this.method = method;
        this.args = args;
    }
    
    step (frame) {
        // Evaluate every argument first.
        if (frame.state.finalArgs === undefined) {
            frame.state.finalArgs = [];
            frame.receiveInto("newArg");
        }
        if (frame.state.newArg !== undefined) {
            frame.state.finalArgs.push(frame.state.newArg);
            delete frame.state.newArg;
        }
        if (frame.state.finalArgs.length < this.args.length) {
            frame.evaluateNext(this.args[frame.state.finalArgs.length]);
            return;
        }
        
        vm.pop();
        frame.context.selfCallMethod(this.method, ...frame.state.finalArgs);
    }
    
    toString() {
        if (this.args.length === 0) { return this.method };
        return this.method + "(" + this.args.join(", ") + ")"
    }
}
class CallTerm {
    constructor (receiver, method, args) {
        this.receiver = receiver;
        this.method = method;
        this.args = args;
    }
    
    step (frame) {
        // Evaluate the receiver and every argument first.
        if (frame.state.finalReceiver === undefined) {
            frame.receiveInto("finalReceiver");
            frame.evaluateNext(this.receiver);
            return;
        }
        
        if (frame.state.finalArgs === undefined) {
            frame.state.finalArgs = [];
        }
        if (frame.state.newArg !== undefined) {
            frame.state.finalArgs.push(frame.state.newArg);
        }
        if (frame.state.finalArgs.length < this.args.length) {
            frame.receiveInto("newArg");
            frame.evaluateNext(this.args[frame.state.finalArgs.length]);
            return;
        }
        
        vm.pop();
        frame.state.finalReceiver.callMethod(this.method, ...frame.state.finalArgs);
    }
    
    toString() {
        return this.receiver.toString() + " " + this.method + "(" + this.args.join(", ") + ")"
    }
}
class PropertyDefTerm {
    constructor (signature, expression) {
        this.signature = signature;
        this.expression = expression;
    }
    
    step (frame) {
        if (frame.state.finalValue === undefined) {
            frame.receiveInto("finalValue");
            frame.evaluateNext(this.expression);
            return;
        }
        
        vm.pop();
        frame.context.defineProperty(this.signature.method, frame.state.finalValue);
        vm.receive(frame.state.finalValue);
    }
    
    toString() {
        return this.signature.toString() + " := " + this.expression;
    }
}
class MethodDefTerm {
    constructor (signature, expression) {
        this.signature = signature;
        this.expression = expression;
    }
    
    step (frame) {
        const parameters = this.signature.args.map((arg) => arg.method);
        
        vm.pop();
        frame.context.methods[this.signature.method] = new EMethod(frame.context, parameters, this.expression);
        vm.receive(frame.context);
    }
    
    toString() {
        return this.signature.toString() + " -> " + this.expression;
    }
}
class ObjectTerm {
    constructor (expression) {
        this.expression = expression;
    }
    
    step (frame) {
        // Create a new object from the current context and evaluate it.
        // Then ignore the result and return the object.
        if (frame.state.ignore !== undefined) {
            vm.pop();
            vm.receive(frame.state.object);
            return;
        }
        
        const object = new EObject(frame.context);
        frame.state.object = object;
        
        frame.receiveInto("ignore");
        vm.push(new EFrame(object, this.expression));
    }
    
    toString() {
        return "(| " + this.expression + " |)";
    }
}
class DelegateTerm {
    constructor (expression) {
        this.expression = expression;
    }
    
    step (frame) {
        if (frame.state.finalValue === undefined) {
            frame.receiveInto("finalValue");
            frame.evaluateNext(this.expression);
            return;
        }
        
        const delegate = frame.state.finalValue;
        for (let method in delegate.methods) {
            frame.context.methods[method] = delegate.methods[method];
        }
        
        if (delegate.value !== undefined) {
            frame.context.value = delegate.value;
        }
        
        vm.pop();
        vm.receive(frame.context);
    }
    
    toString() {
        return ":=" + this.expression;
    }
}
class LambdaTerm {
    constructor (parameters, expression) {
        this.parameters = parameters;
        this.expression = expression;
    }
    
    step (frame) {
        const parameters = this.parameters.map((arg) => arg.method);
        
        const lambda = new EObject();
        lambda.methods["call"] = new ELambda(frame.context, parameters, this.expression, frame.methodExit);
        
        vm.pop();
        vm.receive(lambda);
    }
    
    toString() {
        return "\\(" + this.parameters.join(", ") + ")" + " -> (" + this.expression + ")";
    }
}
class SequenceTerm {
    constructor (first, rest) {
        this.first = first;
        this.rest = rest;
    }
    
    step (frame) {
        if (frame.state.ignore === undefined) {
            frame.receiveInto("ignore");
            frame.evaluateNext(this.first);
            return;
        }
        
        vm.pop();
        frame.evaluateNext(this.rest);
    }
    
    toString() {
        return this.first.toString() + "; " + this.rest;
    }
}
class TupleTerm {
    constructor (...expressions) {
        this.expressions = expressions;
    }
    
    step (frame) {
        vm.pop();
        
        if (this.expressions.length === 0) {
            vm.receive(eNull);
            return;
        }
        if (this.expressions.length === 1) {
            frame.evaluateNext(this.expressions[0]);
            return;
        }
        
        throw "Cannot use a tuple in this position";
        vm.receive(eNull);
    }
    
    toString() {
        return "(" + this.expressions.join(", ") + ")";
    }
}
class ReturnTerm {
    constructor (expression) {
        this.expression = expression;
    }
    
    step (frame) {
        if (frame.state.finalValue === undefined) {
            frame.receiveInto("finalValue");
            frame.evaluateNext(this.expression);
            return;
        }
        
        vm.jump(vm.frame.methodExit);
        vm.receive(frame.state.finalValue);
    }
    
    toString() {
        return "^ " + this.expression;
    }
}

class EFrame {
    constructor (context, term) {
        this.context = context;
        this.term = term;
        
        this.caller = null;
        this.state = Object.create(null);
        this.recipient = null;
        
        this.methodExit = null;
    }
    
    pushed (caller, tailCaller) {
        // 'caller' is the nominal caller, i.e. where to return control to when this frame's done.
        // 'tailCaller' is the "real" caller, i.e. the frame that pushed this caller onto the stack, even if it tailPopped itself first.
        this.caller = caller;
        if (this.methodExit === null && tailCaller !== null) {
            this.methodExit = tailCaller.methodExit;
        }
    }
    
    step () {
        this.term.step(this);
    }
    receive (value) {
        if (this.recipient === null) { return; }
        this.state[this.recipient] = value;
    }
    
    receiveInto (recipient) {
        this.recipient = recipient;
    }
    
    evaluateNext (term) {
        vm.push(new EFrame(this.context, term));
    }
    evaluateInner (term) {
        vm.push(new EFrame(new EObject(this.context), term));
    }
}

class EObject {
    constructor (owner = null) {
        this.owner = owner;
        this.fields = Object.create(null);
        this.methods = Object.create(null);
    }
    
    // Object method call
    callMethod (method, ...args) {
        const impl = this.methods[method];
        if (impl === undefined) {
            throw "No method in scope: " + method + " (note: semicolons are mandatory)";
            
            vm.receive(eNull);
            return;
        }
        return impl.evaluate(...args);
    }
    // Same but with lexical scope access
    selfCallMethod (method, ...args) {
        const impl = this.methods[method];
        if (impl === undefined) {
            if (this.owner === null) {
                throw "No function in scope: " + method;
                
                vm.receive(eNull);
                return;
            }
            
            return this.owner.selfCallMethod(method, ...args);
        }
        
        return impl.evaluate(...args);
    }
    
    defineProperty (name, value) {
        this.methods[name] = new EGetter(this, name);
        this.methods["" + name + "="] = new ESetter(this, name);
        this.fields[name] = value;
    }
}

class EMethod {
    constructor (receiver, parameters, code) {
        this.receiver = receiver;
        this.parameters = parameters;
        this.code = code;
    }
    
    evaluate (...args) {
        const context = new EObject(this.receiver);
        
        for (let i = 0; i < this.parameters.length; i++) {
            context.defineProperty(this.parameters[i], args[i]);
        }
        
        const frame = new EFrame(context, this.code);
        frame.methodExit = vm.frame;
        vm.push(frame);
    }
}
class ELambda {
    constructor (receiver, parameters, code, methodExit) {
        this.receiver = receiver;
        this.parameters = parameters;
        this.code = code;
        this.methodExit = methodExit;
    }
    
    evaluate (...args) {
        const context = new EObject(this.receiver);
        
        for (let i = 0; i < this.parameters.length; i++) {
            context.defineProperty(this.parameters[i], args[i]);
        }
        
        const frame = new EFrame(context, this.code);
        frame.methodExit = this.methodExit;
        vm.push(frame);
    }
}
class EPrimitive {
    constructor (func) {
        this.func = func;
    }
    
    evaluate (...args) {
        return this.func(...args);
    }
}
class EGetter {
    constructor (receiver, name) {
        this.receiver = receiver;
        this.name = name;
    }
    
    evaluate () {
        vm.receive(this.receiver.fields[this.name]);
    }
}
class ESetter {
    constructor (receiver, name) {
        this.receiver = receiver;
        this.name = name;
    }
    
    evaluate (value) {
        this.receiver.fields[this.name] = value;
        vm.receive(value);
    }
}

class VM {
    constructor (frame = null) {
        this.frame = frame;
        this.errorFrame = null;
        
        this.yielding = false;
        this.waitUntil = -1;
        
        this.tailCaller = null;
    }
    
    jump (frame) {
        // console.log("jump", frame);
        this.frame = frame;
        this.errorFrame = frame;
    }
    
    push (frame) {
        // console.log("push", frame);
        frame.pushed(this.frame, this.tailCaller !== null ? this.tailCaller : this.frame);
        
        this.frame = frame;
        this.errorFrame = frame;
        
        this.tailCaller = null;
    }
    pop () {
        // console.log("pop", this.frame);
        this.tailCaller = this.frame;
        this.frame = this.frame.caller;
    }
    
    receive (value) {
        if (this.frame === null) {
            return;
        }
        
        this.errorFrame = this.frame;
        this.tailCaller = null;
        
        this.frame.receive(value);
    }
    step () {
        this.frame.step();
    }
    
    tick () {
        if (Date.now() < this.waitUntil) { return; }
        this.yielding = false;
        
        if (this.frame === null) { return; }
        
        try {
            for (let i = 0; i < 10000; i++) {
                this.step();
                if (this.frame === null || this.yielding) { return; }
            }
        } catch (message) {
            throw this.error(message);
        }
    }
    wait (seconds) {
        this.waitUntil = Date.now() + seconds * 1000;
        this.yielding = true;
    }
    
    error (message) {
        if (this.errorFrame === null) {
            return "Runtime error!\n\n\tUnknown location\n\n" + message;
        }
        return "Runtime error!\n\n\t" + this.errorFrame.term + "\n\n" + message;
    }
}
const vm = new VM();

function wrap(value) {
    const object = new EObject();
    object.value = value;
    
    if (typeof value === "string") {
        object.methods["++"] = new EPrimitive((other) => {
            vm.receive(wrap(value + other.value));
        });
        object.methods["at"] = new EPrimitive((index) => {
            vm.receive(wrap(value.at(index.value)));
        });
        object.methods["=="] = new EPrimitive((other) => {
            vm.receive(wrap(value === other.value));
        });
        
        object.methods["asString"] = new EPrimitive(() => {
            vm.receive(object);
        });
        
        return object;
    } else if (typeof value === "number") {
        object.methods["+"] = new EPrimitive((other) => {
            vm.receive(wrap(value + +other.value));
        });
        object.methods["-"] = new EPrimitive((other) => {
            vm.receive(wrap(value - other.value));
        });
        object.methods["*"] = new EPrimitive((other) => {
            vm.receive(wrap(value * other.value));
        });
        object.methods["/"] = new EPrimitive((other) => {
            vm.receive(wrap(value / other.value));
        });
        object.methods["%"] = new EPrimitive((other) => {
            // Modulo forever <3
            const remainder = value % other.value;
            vm.receive(wrap(remainder < 0 ? remainder + Math.abs(other.value) : remainder));
        });
        
        object.methods["degToRad"] = new EPrimitive(() => {
            vm.receive(wrap(value * Math.PI / 180));
        });
        object.methods["radToDeg"] = new EPrimitive(() => {
            vm.receive(wrap(value * 180 / Math.PI));
        });
        
        object.methods["abs"] = new EPrimitive(() => {
            vm.receive(wrap(Math.abs(value)));
        });
        object.methods["negated"] = new EPrimitive(() => {
            vm.receive(wrap(-value));
        });
        object.methods["sin"] = new EPrimitive(() => {
            vm.receive(wrap(Math.sin(value)));
        });
        object.methods["cos"] = new EPrimitive(() => {
            vm.receive(wrap(Math.cos(value)));
        });
        object.methods["tan"] = new EPrimitive(() => {
            vm.receive(wrap(Math.tan(value)));
        });
        
        object.methods["<"] = new EPrimitive((other) => {
            vm.receive(wrap(value < other.value));
        });
        object.methods["=="] = new EPrimitive((other) => {
            vm.receive(wrap(value === other.value));
        });
        object.methods[">"] = new EPrimitive((other) => {
            vm.receive(wrap(value > other.value));
        });
        object.methods["<="] = new EPrimitive((other) => {
            vm.receive(wrap(value <= other.value));
        });
        object.methods[">="] = new EPrimitive((other) => {
            vm.receive(wrap(value >= other.value));
        });
        
        object.methods["asString"] = new EPrimitive(() => {
            vm.receive(wrap("" + value));
        });
        
        return object;
    } else if (typeof value === "boolean") {
        object.methods["test"] = new EPrimitive((trueBody, falseBody) => {
            if (value) {
                trueBody.callMethod("call");
                return;
            }
            falseBody.callMethod("call");
        });
        
        object.methods["&"] = new EPrimitive((other) => {
            vm.receive(wrap(value && other.value !== false));
        });
        object.methods["|"] = new EPrimitive((other) => {
            vm.receive(wrap(value || other.value !== false));
        });
        
        object.methods["asString"] = new EPrimitive(() => {
            vm.receive(wrap("" + value));
        });
        
        return object;
    }
    
    throw "Unexpected value type: " + typeof value;
    return eNull;
}

const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

const codebox = document.getElementById("codebox");
const outputbox = document.getElementById("outputbox");
const exampleList = document.getElementById("exampleList");

let mouse = {x: 0, y: 0, pressed: false};

window.addEventListener('mousemove', (event) => {
    rect = canvas.getBoundingClientRect();
    mouse.x = Math.round((event.clientX - rect.left) * 960 / rect.width);
    mouse.y = Math.round((event.clientY - rect.top) * 720 / rect.height);
});

window.addEventListener("mousedown", () => {mouse.pressed = true});
window.addEventListener("mouseup", () => {mouse.pressed = false});

function createEnv() {
    const env = new EObject();
    
    env.methods["basicPrint"] = new EPrimitive((content) => {
        outputbox.appendChild(document.createTextNode(content.value + "\n"));
        vm.receive(eNull);
    });
    env.methods["wait"] = new EPrimitive((seconds) => {
        vm.wait(seconds !== undefined ? seconds.value : 0);
        vm.receive(eNull);
    });
    
    env.defineProperty("true", wrap(true));
    env.defineProperty("false", wrap(false));
    env.defineProperty("null", eNull);
    
    const eCanvas = new EObject();
    env.defineProperty("canvas", eCanvas);
    
    eCanvas.methods["clear"] = new EPrimitive(() => {
        ctx.reset();
        vm.receive(eNull);
    });
    eCanvas.methods["fillRect"] = new EPrimitive((colour, startX, startY, sizeX, sizeY) => {
        ctx.fillStyle = colour.value;
        ctx.fillRect(startX.value, startY.value, sizeX.value, sizeY.value);
        vm.receive(eNull);
    });
    eCanvas.methods["strokeRect"] = new EPrimitive((colour, startX, startY, sizeX, sizeY) => {
        ctx.strokeStyle = colour.value;
        ctx.strokeRect(startX.value, startY.value, sizeX.value, sizeY.value);
        vm.receive(eNull);
    });
    eCanvas.methods["clearRect"] = new EPrimitive((startX, startY, sizeX, sizeY) => {
        ctx.strokeRect(startX.value, startY.value, sizeX.value, sizeY.value);
        vm.receive(eNull);
    });
    eCanvas.methods["line"] = new EPrimitive((colour, startX, startY, endX, endY) => {
        ctx.strokeStyle = colour.value;
        ctx.beginPath();
        ctx.moveTo(startX.value, startY.value);
        ctx.lineTo(endX.value, endY.value);
        ctx.stroke();
        vm.receive(eNull);
    });
    eCanvas.methods["write"] = new EPrimitive((text, colour, x, y) => {
        ctx.font = "30px Arial";
        ctx.fillStyle = colour.value;
        ctx.fillText(text.value, x.value, y.value);
        vm.receive(eNull);
    });
    
    const eMouse = new EObject();
    env.defineProperty("mouse", eMouse);
    
    eMouse.methods["x"] = new EPrimitive(() => vm.receive(wrap(mouse.x)));
    eMouse.methods["y"] = new EPrimitive(() => vm.receive(wrap(mouse.y)));
    eMouse.methods["pressed"] = new EPrimitive(() => vm.receive(wrap(mouse.pressed)));
    
    return env;
}

const eNull = new EObject();
eNull.value = null;

const prelude = `
forever(body) -> (
  body call;
  wait;
  forever(body);
);
if(cond, body) -> (
  cond test (-> (| else := body call; elseif := else; |), -> (| else(body) -> body call; elseif(cond, body) -> if(cond, body) |));
);
not(cond) -> if (cond, -> false) else (-> true);

print(str) -> basicPrint(str asString);

Point(x, y) -> (|
  x := x;
  y := y;

  + other -> Point(x + other x, y + other y);
  - other -> Point(x - other x, y - other y);
  * scalar -> Point(x * scalar, y * scalar);
  / scalar -> Point(x / scalar, y / scalar);

  < other -> x < other x & y < other y;
  <= other -> x <= other x & y <= other y;
  == other -> x == other x & y == other y;
  >= other -> x >= other x & y >= other y;
  > other -> x > other x & y > other y;

  asString -> "Point(" ++ x asString ++ ", " ++ y asString ++ ")";
|);

Pen() -> (|
  _pos := Point(480, 360);
  direction := 0;
  
  pressed := false;
  colour := "#000000";
  
  position -> _pos;
  position = newPos -> (
    if (pressed, ->
      canvas line(colour, position x, position y, newPos x, newPos y)
    );
    _pos = newPos;
  );
  
  move(steps) -> (
    newPos := position + Point(steps * direction degToRad cos, steps * direction degToRad sin);
    position = newPos;
  );
  turnLeft(angle) -> (
    direction = direction + angle;
  );
  turnRight(angle) -> (
    direction = direction - angle;
  );
  
  down -> pressed = true;
  up -> pressed = false;
|);
`

const examples = Object.create(null);

examples[""] = ``;
examples.syntax = `# EScript
# Basic syntax demo:

# Define a variable:
x := 3;

# Define functions:
hello -> print("Hello world!");

factorial(n) -> (
  if (n <= 1, ->
    1
  ) else (->
    n * factorial(n - 1)
  )
);

# Call functions:
hello;
print(factorial(10));

# Create an object:
bob := (|
  name := "Bob";
  talk -> (print("Eyup there, I'm " ++ name ++ "!"));
|);

# Access object variables and functions:
print(bob name);
bob talk;

# Assign new values to existing variables:
x = 4;
bob name = "Robert";
bob talk;
`;
examples.box = `vx := 5; vy := 5;
x := 0; y := 0;

forever (->
  canvas clear;
  canvas fillRect("#FF0000", x, y, 40, 40);

  x = x + vx;
  y = y + vy;

  if (x > 920, ->
    vx = vx abs negated)
  elseif (x < 0, ->
    vx = vx abs);
  
  if (y > 680, ->
    vy = vy abs negated)
  elseif (y < 0, ->
    vy = vy abs)
);
`;
examples.tree = `pen := Pen();

recurse(depth) -> (
  if (depth <= 0, -> ^);
  
  pen down;
  pen move(5 * depth);
  pen up;
  
  pen turnLeft(10);
  recurse(depth - 1);
  pen turnRight(20);
  recurse(depth - 1);
  pen turnLeft(10);
  
  pen move(-5 * depth);
);

recurse(10);
`;
examples.paint = `pen := Pen();
wasPressed := false;

forever(->
  if (mouse pressed & not(wasPressed), ->
    pen down;
  );
  if (not(mouse pressed) & wasPressed, ->
    pen up;
  );
  pen position = Point(mouse x, mouse y);

  wasPressed = mouse pressed;
);
`


function run(code) {
    outputbox.innerHTML = "";
    ctx.reset();
    
    let AST = null;
    try {
        AST = new Parser(new Lexer(new Reader(prelude + code))).run();
    } catch (message) {
        outputbox.appendChild(document.createTextNode(message));
        
        vm.jump(null);
        return;
    }
    
    vm.jump(new EFrame(createEnv(), AST));
}

codebox.addEventListener("input", function () {
    exampleList.value = "";
    run(this.value);
});
codebox.addEventListener("keydown", function (e) {
    if (e.key == 'Tab') {
        e.preventDefault();
        var start = this.selectionStart;
        var end = this.selectionEnd;

        // set textarea value to: text before caret + tab + text after caret
        this.value = this.value.substring(0, start) +
          "  " + this.value.substring(end);

        // put caret at right position again
        this.selectionStart = this.selectionEnd = start + 2;
    }
});

exampleList.addEventListener("change", function (e) {
    codebox.value = examples[this.value];
    run(codebox.value);
});

setInterval(() => {
    try {
        vm.tick();
    } catch (message) {
        outputbox.appendChild(document.createTextNode(message + "\n"));
        vm.jump(null);
    }
}, 1000/30);

