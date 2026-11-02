+++
title = "La recuperación forma parte del sistema"
date = 2026-11-02
description = "Un sistema no es resiliente porque evite todos los fallos, sino porque puede volver a un estado fiable."
[taxonomies]
tags = ["software", "resiliencia", "liderazgo", "disciplina", "tolkien"]
[extra]
cover = "https://images.unsplash.com/photo-1518005020951-eccb494ad742?w=1200&q=80&auto=format&fit=crop"
+++

Un sistema no es resiliente porque evite todos los fallos. Lo es cuando puede volver a un estado fiable.

Admiramos el camino que crea: el despliegue, la migración, la automatización, la entrega. El camino de vuelta recibe menos atención. Los scripts para revertir cambios se escriben tarde. Se da por buena una copia de seguridad sin probar su restauración. Se espera que alguien recuerde los pasos que faltan cuando producción ya está ardiendo.

La recuperación debe diseñarse, no improvisarse. Una migración de base de datos debería indicar si puede revertirse y qué se perdería. Un despliegue debería conservar el último estado válido. Un agente automatizado debería dejar pruebas de lo que ha cambiado y detenerse antes de cruzar un límite que no pueda deshacer. La cuestión no es si puede haber un fallo. Siempre puede haberlo. La cuestión es si el fallo deja un camino claro de regreso.

Tras la Batalla de los Campos del Pelennor, Aragorn no demuestra su derecho al trono solo mediante la victoria. Entra en las Casas de Curación y atiende a Faramir, Éowyn y Merry. Tolkien concede a la restauración su propia autoridad: «Las manos del rey son las manos de un sanador». La capacidad de vencer a un enemigo queda incompleta sin la capacidad de reparar lo que la lucha ha dañado.

Los equipos de software suelen premiar a quien entrega el cambio y pasar por alto a quien consigue que recuperarse sea aburrido. Es un error. Un procedimiento de restauración probado, una entrega pequeña y reversible y un registro honesto del incidente no son mantenimiento secundario. Forman parte de la funcionalidad porque determinan si podemos confiar en ella.

No preguntes solo si el sistema funciona. Pregunta qué ocurre después de que deje de hacerlo.
