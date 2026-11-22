---
name: Ranking regional de execução
description: Requisito do painel para exibir as lojas líderes por região no mês vigente.
---

O painel de análise deve apresentar as três lojas mais bem pontuadas por supervisor, considerando o mês vigente. O cabeçalho identifica cada grupo como “Região N” junto ao nome do supervisor; não usar a localização geográfica da loja para separar os grupos.

Na aba Lojas, manter o ranking geral da rede e também exibir um ranking completo separado por supervisor, com todas as lojas ordenadas dentro de cada grupo “Região N”. Não agrupar esses quadros pela localização geográfica. Ao final, manter a soma e classificação dos supervisores. Os filtros de período, localização e supervisor se aplicam aos rankings; não substituir o ranking geral pela visão regional.

Os três primeiros lugares devem usar cores distintas de pódio: ouro, prata e bronze, com apresentação moderna.

Após as listas das regiões, exiba um ranking de supervisores com a soma dos pontos de todas as lojas da região no mês. Classifique os quatro primeiros como ouro, prata, bronze e cobre.

Use paletas diferentes para os rankings: quadros de regiões/lojas em teal e quadros de supervisores pretos. Use os modelos visuais enviados pelo usuário: pódio das três lojas destacadas por região; no ranking de supervisores, resumo de pontos/lojas/lojas com tarefa concluída, pódio dos três primeiros e lista completa com barras proporcionais à pontuação do líder e diferença em pontos. Rotule percentuais de conclusão como proporção de lojas com pelo menos uma tarefa concluída.

Na classificação completa da aba Lojas, mantenha cada região dentro de um quadro visual independente e destaque ouro, prata e bronze nas três primeiras unidades. Separe os quatro supervisores medalhistas num quadro de destaques antes da classificação completa.

No quadro geral, mantenha os nomes dos supervisores legíveis, diferencie visualmente cada medalha metálica e destaque o rótulo compacto da região em verde-água sem aumentar sua caixa.

**Why:** O usuário pediu comparações gerais e regionais sem perder nenhuma loja da lista, além da soma de pontos por supervisor com pódios identificados por metais e enviou exemplos visuais para orientar esses quadros. Em 21 de novembro de 2026, esclareceu que os grupos completos devem seguir os supervisores, não a localização, e que as paletas regionais devem diferir da preta usada para supervisores.

**How to apply:** Derivar todos os resumos e barras de pontos/contagens reais, nunca de valores ilustrativos. No painel inicial, mostrar as três lojas líderes de cada grupo identificado pelo supervisor cadastrado. Na aba Lojas, preservar o ranking geral, agrupar cada loja pelo supervisor responsável com posições independentes e numeração “Região N”, deixar claro que o filtro de localização é geográfico e manter o ranking de supervisores ao final; todos usam a pontuação já definida e o período selecionado.

Para compartilhar rankings em PDF com a mesma aparência da interface em celulares, capture o quadro em trechos do tamanho de uma página, em vez de criar um canvas único muito alto. Use os deslocamentos padrão de rolagem do html2canvas, sem passar valores negativos manualmente.

**Why:** Um canvas alto pode exceder limites do navegador móvel, e coordenadas negativas de rolagem deslocam o quadro capturado; páginas capturadas separadamente e offsets padrão evitam distorções.

**How to apply:** Calcule os cortes em posições seguras entre cartões/linhas, capture cada fatia direto do DOM e adicione cada imagem dentro da área da página. Garanta que as ações de exportação não apareçam na captura.
