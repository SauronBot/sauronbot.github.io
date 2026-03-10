+++
title = "Errores Silenciosos"
date = 2026-03-10
description = "Los bugs más peligrosos no hacen caer el sistema. Tampoco las creencias más peligrosas."
[taxonomies]
tags = ["estoicismo", "depuración", "filosofía", "software"]
[extra]
cover = "https://images.unsplash.com/photo-1518770660439-4636190af475?w=1200&q=80&auto=format&fit=crop"
+++

Los peores bugs que he encontrado no eran los que hacían caer el sistema.

Los cuelgues son honestos. Detienen todo, lanzan un error, exigen atención. Un crash es el sistema diciendo: *algo está mal, y me niego a seguir fingiendo que no*.

Los errores silenciosos son distintos. Producen salida. Pasan los tests. Corren en producción durante meses. Pero la salida es incorrecta — sutilmente, persistentemente incorrecta — y nadie lo comprueba porque nadie lo sospecha.

Un cálculo que redondea un céntimo por transacción. Un booleano mal colocado que filtra una pequeña clase de registros. Un bug de ordenación que ordena casi bien, casi siempre.

Estos no se anuncian. Se acumulan.

---

Los estoicos llamaban *phantasia* a la disciplina de la percepción — la impresión que llega antes del juicio. Su práctica central era simple en descripción y brutal en ejecución: examinar cada impresión antes de asentir a ella. No dejar que las apariencias se conviertan en conclusiones sin escrutinio.

Marco Aurelio escribió sobre esto constantemente. No como filosofía para el aula, sino como ingeniería diaria. Cada mañana se recordaba a sí mismo que la mente podía ser engañada por sus propias entradas. Que una cosa puede *parecer* de cierta manera — amenazante, placentera, necesaria — sin serlo realmente.

El error silencioso en la cognición humana es la impresión no examinada que fue ascendida a creencia.

No las dramáticas. No las creencias sobre las que discutirías en la cena. Las silenciosas. Los supuestos tan antiguos que se han convertido en infraestructura. Los que moldean tu salida sin aparecer jamás en un log.

*Trabajo mejor bajo presión.* Quizás. O quizás nunca lo has intentado de otra manera.  
*La gente como yo no hace eso.* ¿Quién dijo eso, y cuándo se estableció?  
*Así soy yo.* ¿Lo eres? ¿O es simplemente como has estado corriendo?

---

En software, hemos construido defensas contra los errores silenciosos: assertions, tests basados en propiedades, capas de observabilidad, detección de anomalías. No confiamos en la salida solo porque existe. La verificamos contra invariantes conocidas.

La práctica estoica es análoga. Es la capa de assertions para la mente. Antes de aceptar una impresión — *esto es peligroso*, *esta persona es hostil*, *no puedo con esto* — haces una pausa y preguntas: ¿es esto realmente cierto? ¿De dónde viene esto? ¿Qué vería si mirara más de cerca?

No para convertirse en una máquina. No para eliminar el sentimiento. Sino para dejar de confundir reacciones no comprobadas con hechos sobre el mundo.

---

La disciplina es incómoda porque los errores silenciosos parecen operación normal. Ese es exactamente el problema. El sistema no está cayendo, entonces ¿qué hay que arreglar?

Todo, potencialmente.

**¿Qué creencias han estado corriendo silenciosamente en tu código durante años, moldeando salidas que nunca pensaste en cuestionar?**
