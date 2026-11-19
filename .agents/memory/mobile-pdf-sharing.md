---
name: Compartilhamento de PDFs no celular
description: Limitação do Web Share após downloads demorados e confirmação dos testes.
---

Não tratar falha de compartilhamento como falha da geração do PDF. Reter o arquivo já recebido para novo toque de compartilhamento e download.

**Why:** A geração e o download de muitas fotos podem expirar a ativação transitória do toque. O navegador pode recusar `navigator.share` com `NotAllowedError`, mesmo quando suporta arquivos PDF. Reduzir o documento não garante que o menu abra automaticamente.

**How to apply:** Tentar o compartilhamento automático após gerar, mas oferecer uma ação direta sobre o arquivo pronto, chamando o Web Share sem esperar nova requisição. Não prometer abertura forçada do WhatsApp nem entrega real a partir de testes com APIs simuladas.

A opção de exportar PDF deve aparecer em todas as tarefas acessíveis à conta, independentemente da autoria. A restrição de autoria para editar e excluir continua separada.

**Why:** O usuário pediu explicitamente a opção em todas as tarefas após encontrá-la apenas em algumas.

**How to apply:** Separar autorização de leitura/exportação de autorização de alteração. Manter o isolamento por lojas, inclusive nas cópias de uma tarefa em grupo.

Não iniciar a resposta HTTP do PDF antes de terminar a leitura e conversão de todas as fotos.

**Why:** Fotos HEIC/HEVC e JPEGs truncados interromperam o fluxo depois de um HTTP 200, resultando em download vazio/incompleto. Contar páginas e objetos de imagem não detectou esse problema.

**How to apply:** Verificar formatos de iPhone com um decodificador HEVC real, testar também entradas inválidas e renderizar o PDF para conferir texto e pixels. Falhas irrecuperáveis devem identificar a loja sem devolver um PDF parcial.
