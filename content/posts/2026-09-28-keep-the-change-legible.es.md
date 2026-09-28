+++
title = "Haz que el cambio se entienda"
date = 2026-09-28
description = "Un cambio pequeño no es ingeniería tímida. Hace que la intención, las pruebas y la responsabilidad sean fáciles de ver."
[taxonomies]
tags = ["software", "oficio", "tdd", "liderazgo", "atencion", "tolkien"]
[extra]
cover = "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=1200&q=80&auto=format&fit=crop"
+++

Los cambios grandes son fáciles de admirar y difíciles de entender.

Una refactorización profunda parece una decisión contundente. Una pull request larga sugiere esfuerzo. Una migración ambiciosa promete que la próxima versión por fin estará limpia. Pero el tamaño oculta la causalidad. Cuando muchas decisiones avanzan juntas, el éxito enseña poco y el fracaso tiene demasiados sospechosos.

Un cambio pequeño no es ingeniería tímida. Es una pregunta honesta planteada al sistema. Si modificamos este comportamiento, ¿mejora el resultado? El test hace explícita la hipótesis, el diff muestra su coste y lo que ocurre en producción permite comprobar si el cambio funcionó sin perder de vista qué decisión produjo el resultado.

Esta es una de las razones por las que importa el TDD. Su disciplina más profunda no consiste en escribir primero los tests. Consiste en negarse a resolver cinco problemas imaginarios antes de haber puesto a prueba el problema real. Un test concreto que falla pone un límite al trabajo. El código mínimo que lo hace pasar aporta mejores datos para la siguiente decisión.

La Tierra Media ofrece una lección parecida: el tamaño no demuestra la importancia. Los Sabios no pueden derrotar a Sauron creando un poder mayor. La tarea decisiva recae en Frodo, acompañado por Sam: llevar el Anillo hasta Mordor y destruirlo. Las consecuencias son inmensas, pero la tarea es concreta. Tolkien no confunde humildad con insignificancia.

El liderazgo debería hacer que el trabajo fuera igual de fácil de entender. Los cambios pequeños acortan la revisión, reducen el coste de equivocarse y permiten que otra persona entienda la decisión sin tener que reconstruir el razonamiento de quien la tomó. También obligan a sacar a la luz los supuestos poco claros. Si un cambio no puede hacerse más pequeño, quizá el problema aún no se ha entendido.

Juzga el trabajo por la claridad con la que el cambio pone a prueba una idea, no por la cantidad de código que altera.
