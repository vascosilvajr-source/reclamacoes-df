// api/triagem.js
// Função serverless da Vercel: recebe o texto de um e-mail de reclamação e
// devolve uma sugestão de classificação (tema, categoria, gravidade, canal,
// resumo e contexto), usando a API da Anthropic. A pessoa confirma/corrige
// sempre estes valores no formulário — isto é só uma sugestão.
//
// Configuração necessária na Vercel (Project Settings → Environment Variables):
//   ANTHROPIC_API_KEY = a tua chave de api.anthropic.com/settings/keys

const TEMAS_CONHECIDOS = [
  "Comportamento de treinador",
  "Comportamento de colega",
  "Convocatórias / minutos de jogo",
  "Comunicação com encarregados de educação",
  "Mensalidades / pagamentos",
  "Transporte",
  "Instalações",
  "Equipamento desportivo",
  "Horários de treino",
  "Outro",
];

const CATEGORIAS_CONHECIDAS = ["Disciplinar", "Técnico", "Infraestrutura e Equipamentos"];

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Método não permitido" });
    return;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "ANTHROPIC_API_KEY não está configurada na Vercel." });
    return;
  }

  const { text, temas, categorias } = req.body || {};
  if (!text || typeof text !== "string" || !text.trim()) {
    res.status(400).json({ error: "Texto em falta." });
    return;
  }

  const listaTemas = Array.isArray(temas) && temas.length > 0 ? temas : TEMAS_CONHECIDOS;
  const listaCategorias = Array.isArray(categorias) && categorias.length > 0 ? categorias : CATEGORIAS_CONHECIDAS;

  const systemPrompt = `Classificas reclamações recebidas por uma academia de futebol (Dragon Force, FC Porto).
Devolve APENAS um objeto JSON válido, sem markdown, sem texto antes ou depois, com exatamente estes campos:

{
  "canal": um de "email" | "presencial" | "livro" | "redes" (deduz do texto; assume "email" se não for claro),
  "categoria": escolhe EXATAMENTE uma destas opções (copia o texto tal e qual): ${listaCategorias.join(" | ")}
    — se nenhuma servir bem, devolve "" (string vazia),
  "tema": escolhe EXATAMENTE uma destas opções (copia o texto tal e qual): ${listaTemas.join(" | ")}
    — se nenhuma servir bem, devolve "" (string vazia),
  "gravidade": um de "baixa" | "media" | "alta" (alta = envolve agressão, ameaça, insulto grave, risco de segurança; media = situação relevante mas sem risco imediato; baixa = pedido simples ou reclamação menor),
  "resumo": um resumo objetivo em 1-2 frases, em português de Portugal, do que a pessoa está a reclamar,
  "contexto": quaisquer detalhes adicionais relevantes (datas, nomes mencionados, histórico) em 1-3 frases; deixa "" se não houver nada relevante para além do resumo
}`;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-5",
        max_tokens: 500,
        system: systemPrompt,
        messages: [{ role: "user", content: text.slice(0, 8000) }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      res.status(502).json({ error: "Erro ao contactar a API da Anthropic", detail: errText });
      return;
    }

    const data = await response.json();
    const raw = (data.content || [])
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("");

    const cleaned = raw.replace(/```json|```/g, "").trim();
    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch (parseErr) {
      res.status(502).json({ error: "Resposta da IA não é JSON válido", raw: cleaned });
      return;
    }

    res.status(200).json(parsed);
  } catch (err) {
    res.status(500).json({ error: "Falha inesperada na triagem", detail: String(err) });
  }
}
