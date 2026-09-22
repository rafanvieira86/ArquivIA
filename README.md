# TRF2 — Inventário por OCR

Web app estático baseado na planilha enviada.

- 29 campos da Plan1.
- Listas suspensas mantidas manualmente:
  - Situação da Revisão: Manter / Excluir / Dúvida
  - Caixa atual diz que tem documento?: Sim / Não
- A coluna `Eliminar em (NÃO ALTERAR - FÓRMULA)` é fórmula no modelo e é calculada no Excel.
- Foto/PDF não é colocado no Excel e os canvases usados pelo OCR são descartados após a leitura.
- No celular, o botão de câmera usa `capture="environment"` para abrir a câmera traseira quando o navegador/dispositivo permitir.

Setores configurados conforme a página oficial de contatos do TRF2, atualizada em 16/09/2026, que informa as unidades localizadas na Rua Acre, 80.

Para publicar, basta colocar os 4 arquivos em GitHub Pages, Netlify, Vercel ou outro servidor de arquivos estáticos.
