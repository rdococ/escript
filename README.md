# EScript

If I had a nickel for every purely object-oriented toy scripting language I've made, I would have two nickels. Which isn't a lot, but it's weird that it happened twice.

## Feature rundown

* No classes, instead there are just object literals
* Variables/properties define getter/setter method pairs
* Function calls are implicit method calls to the lexical scope
* Concise lambda syntax and lexical returns allow traditional control flow to be implemented in the prelude
* Very good at mimicking non-object-oriented programming styles

## Examples

Example class

```
Person(name, age) -> (|
    name := name;
    age := age;
    
    talk -> print("Hello there, my name is " ++ name ++ "!");
|);

bob := Person("Bob", 21);
```

Bouncing "ball" (square until I add more canvas methods ;) ) example

```
ball(colour, x, y, vx, vy, size) -> (|
  tick -> (
    canvas fillRect(colour, x, y, size, size);

    x = x + vx;
    y = y + vy;

    if (x > 960 - size, ->
      vx = vx abs negated)
    elseif (x < 0, ->
      vx = vx abs);
  
    if (y > 720 - size, ->
      vy = vy abs negated)
    elseif (y < 0, ->
      vy = vy abs)
  )
|);

b1 := ball("#FF0000", 0, 0, 5, 5, 40, 40);
b2 := ball("#00FF00", 480, 0, 5, 5, 80, 80);

forever (->
  canvas clear;
  b1 tick;
  b2 tick;
);
```

Fizzbuzz and factorial

```
fizzbuzz(n) -> (
  string := "";
  if (n % 3 == 0, ->
    string = string ++ "fizz");
  if (n % 5 == 0, ->
    string = string ++ "buzz");
  if (string = "", -> n) else (-> string)
);

factorial(n) -> (
  if (n == 1, ->
    1
  ) else (->
    n * factorial(n - 1)
  );
);

print(fizzbuzz(15));
print(factorial(10));
```

But what's 9 + 10?

```
x := (| := 9; + x -> 11 + x |);

print(x * 1); # prints 9
print(x + 10); # prints 21
```



## Loicence notice

EScript

Object-oriented toy scripting language with text & graphical output

Copyright (C) 2023 rdococ

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.