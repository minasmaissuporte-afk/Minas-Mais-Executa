---
name: Compartilhamento de PDFs no celular
description: Limitação do Web Share após downloads demorados e confirmação dos testes.
---

Não tratar falha de compartilhamento como falha da geração do PDF. Reter o arquivo já recebido para novo toque de compartilhamento e download.

**Why:** A geração e o download de muitas fotos podem expirar a ativação transitória do toque. O navegador pode recusar `navigator.share` com `NotAllowedError`, mesmo quando suporta arquivos PDF. Reduzir o documento não garante que o menu abra automaticamente.

**How to apply:** Após gerar, mostrar ações explícitas de compartilhar e baixar o arquivo pronto, chamando o Web Share apenas pelo toque direto e sem esperar nova requisição. Não prometer abertura forçada do WhatsApp nem entrega real a partir de testes com APIs simuladas.

Não tentar compartilhar automaticamente após gerar o PDF nem exibir mensagens de bloqueio do aparelho. Manter as ações de PDF dentro da caixa da tarefa, agrupada ou individual.

**Why:** O usuário pediu ações diretas de compartilhar ou baixar, sem mensagens de bloqueio do aparelho, e o botão dentro da caixa da tarefa.

**How to apply:** Preservar o arquivo após cancelamento ou recusa, oferecendo download com orientação neutra; não confundir falhas de compartilhamento com falhas reais de geração.

Manter o botão de gerar PDF compacto no canto da caixa, sem preencher toda a largura. Ao modernizar o documento, preservar o layout de quatro fotos por página.

**Why:** O usuário considerou o botão grande demais e esclareceu que queria manter o PDF como estava, mudando apenas sua apresentação visual.

**How to apply:** Manter o fundo da caixa da tarefa e destacar apenas o botão; não alterar a quantidade de fotos por página como parte de um refinamento visual.

A opção de exportar PDF deve aparecer em todas as tarefas acessíveis à conta, independentemente da autoria. A restrição de autoria para editar e excluir continua separada.

**Why:** O usuário pediu explicitamente a opção em todas as tarefas após encontrá-la apenas em algumas.

**How to apply:** Separar autorização de leitura/exportação de autorização de alteração. Manter o isolamento por lojas, inclusive nas cópias de uma tarefa em grupo.

Dentro de uma loja, exportar apenas as fotos daquela execução e habilitar o PDF individual quando ela estiver concluída. Na tarefa agrupada, exportar todas as lojas autorizadas, sem exigir abrir cada loja.

**Why:** O usuário solicitou explicitamente essa separação entre PDF da loja e PDF da tarefa inteira; pediu também nomes das lojas em destaque no documento.

**How to apply:** Não inferir o escopo apenas pelo identificador da execução. A intenção de exportar uma loja ou o grupo precisa acompanhar a solicitação; manter a validação de conclusão também no servidor.

Não iniciar a resposta HTTP do PDF antes de terminar a leitura e conversão de todas as fotos.

**Why:** Fotos HEIC/HEVC e JPEGs truncados interromperam o fluxo depois de um HTTP 200, resultando em download vazio/incompleto. Contar páginas e objetos de imagem não detectou esse problema.

**How to apply:** Verificar formatos de iPhone com um decodificador HEVC real, testar também entradas inválidas e renderizar o PDF para conferir texto e pixels. Falhas irrecuperáveis devem identificar a loja sem devolver um PDF parcial.

No cabeçalho dos PDFs, usar “MINAS MAIS EXECUTA”, “Nada é tão bom que não possa melhorar!” e “A excelência em execução!”, com a marca em letras grandes.

**Why:** O usuário pediu essas frases no cabeçalho e confirmou expressamente a grafia “MINAS MAIS EXECUTA”.

**How to apply:** Preservar a grafia e as duas frases em todas as páginas ao refinar a apresentação dos relatórios.

O fundo externo de todo o PDF deve ser preto, mantendo o cabeçalho e as mesmas mensagens. Os quadros das fotos devem ser brancos, com uma moldura clara e moderna.

**Why:** O usuário pediu fundo preto em todo o material, com apresentação moderna e dinâmica.

**How to apply:** Manter textos e identificação das lojas com contraste claro; preservar as fotos e as quatro evidências por página. A área interna de cada quadro deve continuar branca sobre a página preta.
