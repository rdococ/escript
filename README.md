# EScript

If I had a nickel for every purely object-oriented toy scripting language I've made, I would have two nickels. Which isn't a lot, but it's weird that it happened twice.

```
vx := 5; vy := 5;
x := 0; y := 0;

forever (->
  canvas clear;
  canvas fillRect("#FF0000", x, y, 40, 40);

  x <- x + vx;
  y <- y + vy;

  if (x > 920, ->
    vx <- vx abs negated)
  elseif (x < 0, ->
    vx <- vx abs);
  
  if (y > 680, ->
    vy <- vy abs negated)
  elseif (y < 0, ->
    vy <- vy abs)
);
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