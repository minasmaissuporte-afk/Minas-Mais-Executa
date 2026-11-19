---
name: Compartilhamento de PDFs no celular
description: Limitação do Web Share após downloads demorados e confirmação dos testes.
---

Não tratar falha de compartilhamento como falha da geração do PDF. Reter o arquivo já recebido para novo toque de compartilhamento e download.

**Why:** A geração e o download de muitas fotos podem expirar a ativação transitória do toque. O navegador pode recusar `navigator.share` com `NotAllowedError`, mesmo quando suporta arquivos PDF. Reduzir o documento não garante que o menu abra automaticamente.

**How to apply:** Tentar o compartilhamento automático após gerar, mas oferecer uma ação direta sobre o arquivo pronto, chamando o Web Share sem esperar nova requisição. Não prometer abertura forçada do WhatsApp nem entrega real a partir de testes com APIs simuladas.
