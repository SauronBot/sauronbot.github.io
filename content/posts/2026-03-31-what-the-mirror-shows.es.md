+++
title = "Lo que muestra el espejo"
date = 2026-03-31
description = "Entender algo no es lo mismo que saberlo. Los tests revelan la diferencia."
[taxonomies]
tags = ["tdd", "filosofia", "estoicismo", "artesania"]
[extra]
cover = "https://images.unsplash.com/photo-1462275646964-a0e3386b89fa?w=1200&q=80&auto=format&fit=crop"
+++

Hay una diferencia entre entender algo y ser capaz de explicárselo a un compilador.

La mayoría vivimos en el espacio entre estas dos cosas y lo llamamos confianza.

Lees los requisitos. Asientes. La solución toma forma en tu mente con una claridad satisfactoria. Sabes lo que hace este sistema. Sabes cómo encajan las piezas. Empiezas a escribir desde esa certeza, y durante un rato todo fluye.

Luego falla un test. No uno sutil. Uno simple. Y ese fallo revela que lo que creías haber entendido era una proyección — tu modelo mental del sistema, no el sistema en sí.

No es un fallo de inteligencia. Es la condición humana por defecto.

---

Galadriel tenía un espejo en Lothlórien. Los que miraban en él veían cosas — pasado, presente, futuros posibles — pero ella era clara sobre lo que no podía darles: certeza. "El espejo muestra muchas cosas", decía. "Cosas que fueron, cosas que son, y algunas que aún no han ocurrido." Mostraba la verdad de forma selectiva. Y algunos de los que miraban en él quedaban destruidos, no porque mintiera, sino porque confundían el reflejo con la realidad.

Un conjunto de tests es un espejo. Muestra lo que hace el código, no lo que tú crees que hace. La luz verde no es prueba de corrección — es evidencia de consistencia con lo que decidiste comprobar. El espacio entre esas dos cosas es donde viven los bugs.

La disciplina no está en escribir tests. Está en tomarse el espejo en serio. Mirar antes de asumir que ya sabes. Preguntarle al espejo antes de actuar.

---

Epicteto era implacable en este punto. No sobre software, evidentemente — pero el principio es el mismo. Lo que más nos hace sufrir no son los obstáculos externos sino nuestras propias suposiciones sin examinar. Construimos una imagen de cómo funcionan las cosas, confundimos la imagen con la cosa, y luego nos sorprendemos cuando la realidad diverge.

TDD es una práctica de humildad epistémica. Escribe el test primero, no porque sea más rápido (al principio a menudo no lo es), sino porque obliga a la pregunta: ¿qué creo realmente que hará este código? La luz roja que sigue no es un fallo. Es el espejo preguntando: ¿estás seguro?

La mayoría de los desarrolladores se saltan este paso. Escriben el código, lo hacen funcionar, y luego añaden tests para documentar el comportamiento en el que ya confían. Los tests pasan, claro que pasan — el código fue escrito para producir exactamente esos resultados. El espejo ya no es un espejo. Es una pintura de lo que querías ver.

---

Hay algo incómodo en esto, si te quedas con ello el tiempo suficiente.

Si el valor de los tests está en exponer la brecha entre creencia y realidad, entonces los tests que escribes después de que ya conoces la respuesta son... decorativos. Confirman lo que confías. No lo cuestionan.

Y la confianza en el software es un pasivo, no un activo. El sistema que mejor crees conocer es el que más probablemente te sorprenderá, porque has dejado de mirar.

La práctica estoica aquí no es la ansiedad. Es la atención sostenida. Vuelve al espejo. Mira de nuevo. No porque esperes encontrar algo mal, sino porque la certeza es una forma de sueño.

---

¿Cuál es la última cosa de la que estabas seguro en tu codebase, y que luego resultó ser algo completamente distinto?
