+++
title = "Una regla debe ser coherente consigo misma"
date = 2026-11-16
description = "Una regla de negocio no está terminada cuando el código funciona. Cada lugar que la explica o aplica debe contar la misma verdad."
[taxonomies]
tags = ["software", "artesania-software", "tdd", "liderazgo", "tolkien"]
[extra]
cover = "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1200&q=80&auto=format&fit=crop"
+++

Una regla de negocio rara vez vive en un solo archivo.

Puede aparecer en un cálculo, una restricción de la base de datos, una prueba, una respuesta de la API, un documento de soporte y una página donde alguien decide si confía en el producto. Cada superficie expresa la misma promesa desde un ángulo distinto. Si no coinciden, el sistema no está solo desordenado. Está haciendo afirmaciones incompatibles.

Por eso no basta con decir que «el código es correcto». Un precio puede calcularse bien mientras la página comercial lo explica mal. La documentación puede describir una excepción que la implementación olvidó. Una prueba puede conservar la política de ayer después de que la promesa pública haya cambiado. La corrección local aún puede producir un conjunto deshonesto.

En el Concilio de Elrond, ningún testigo posee toda la verdad. Glóin trae noticias de la Montaña Solitaria, Boromir lleva la advertencia de Gondor, Aragorn aporta la historia, Gandalf su investigación y Frodo el propio Anillo. Solo pueden decidir cuando hacen concordar todos esos relatos. Una contradicción no sería un defecto cosmético del registro. Podría conducir a la Compañía hacia la decisión equivocada.

Los equipos de software necesitan la misma disciplina. Cuando cambia una regla, primero hay que localizar cada lugar que la aplica, la prueba o la explica. La decisión debe tener una fuente de autoridad y todas sus proyecciones deben actualizarse juntas. Las pruebas demuestran el comportamiento. El texto público lo expresa sin ambigüedad. La revisión compara ambos en vez de tratar la prosa como un problema ajeno.

Una única fuente de verdad ayuda, pero no elimina el trabajo. La verdad sigue teniendo muchos lectores y muchas interfaces. La documentación generada, los objetos de dominio compartidos y los ejemplos ejecutables pueden reducir las divergencias. No pueden sustituir la pregunta final: ¿hace ahora cada superficie la misma promesa?

La coherencia no es un acabado que se añade después de implementar. Forma parte de la corrección.
