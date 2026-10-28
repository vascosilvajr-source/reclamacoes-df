// Pré-visualização dos e-mails dentro da app. Os modelos são uma cópia dos do script do Google
// (Emails_Escolas.gs): se mudares um, muda o outro. Só mostram dados já anonimizados (códigos, turmas, datas).
const URL_APP = typeof window !== "undefined" ? window.location.origin : "";

function assuntoOperacional_(o) {
  const partes = [];
  if (o.experiencias) partes.push(`${o.experiencias} ${o.experiencias === 1 ? 'experiência' : 'experiências'}`);
  if (o.turmas) partes.push(`${o.turmas} ${o.turmas === 1 ? 'turma/equipa sem alunos' : 'turmas/equipas sem alunos'}`);
  if (!partes.length) return `Dragon Force · ${o.escola}: lotação das turmas e equipas`;
  return `Dragon Force · ${o.escola}: ${partes.join(' e ')} para confirmar`;
}

function htmlOperacional_(o) {
  const link = `${URL_APP}/?op=${encodeURIComponent(o.token)}`;
  const linhas = [];
  if (o.experiencias) linhas.push(`<li><b>${o.experiencias}</b> ${o.experiencias === 1 ? 'experiência com' : 'experiências com'} mais de 2 semanas que ainda não ${o.experiencias === 1 ? 'aparece inscrita' : 'aparecem inscritas'}: diz se converteu, se ainda está a decorrer ou se não converteu (e porquê).</li>`);
  if (o.turmas) linhas.push(`<li><b>${o.turmas}</b> ${o.turmas === 1 ? 'turma ou equipa' : 'turmas ou equipas'} do plano semanal sem alunos inscritos na app: indica os códigos (ID) dos alunos que lá treinam.</li>`);
  if (!linhas.length) linhas.push('<li>Vê a lotação de cada turma ou equipa e, se for preciso, propõe mudanças de alunos.</li>');
  const lot = o.lotacao || [];
  const lotacao = lot.length
    ? `<p style="margin:0 0 8px"><b>Lotação das turmas e equipas</b></p>
    <table style="border-collapse:collapse;width:100%;margin:0 0 6px;font-size:14px"><tr><th style="${th_()}">Turma / equipa</th><th style="${th_()};text-align:right">Alunos</th><th style="${th_()};text-align:right">Lotação</th></tr>${lot
        .map((l) => {
          const cheia = l.cap && l.alunos > l.cap;
          return `<tr><td style="${td_()}">${esc_(l.turma)}</td><td style="${td_()};text-align:right;${cheia ? 'color:#C2570C;font-weight:700' : ''}">${l.alunos}</td><td style="${td_()};text-align:right;color:#5B6577">${l.cap || '—'}</td></tr>`;
        })
        .join('')}</table>
    <p style="margin:0 0 22px;color:#5B6577;font-size:13px">No link, carrega numa turma para ver os códigos dos alunos e propor mudanças. Ficam sempre pendentes até a gestão da qualidade validar.</p>`
    : '';
  return moldura_(`
    <p style="margin:0 0 14px">Olá,</p>
    <p style="margin:0 0 14px">Na <b>${esc_(o.escola)}</b> há pontos para confirmar esta semana:</p>
    <ul style="margin:0 0 18px;padding-left:20px;line-height:1.55">${linhas.join('')}</ul>
    <p style="margin:0 0 22px"><a href="${link}" style="display:inline-block;background:#0B2A5B;color:#fff;text-decoration:none;font-weight:600;padding:12px 22px;border-radius:10px">Abrir e responder</a></p>
    ${lotacao}
    <p style="margin:0;color:#5B6577;font-size:13px">Demora 2 minutos. O link é só da tua escola e vale 10 dias. Podes voltar a abri-lo para corrigir.</p>
  `);
}

function htmlCoordenador_(c) {
  const tec = (c.tecnicos || [])
    .map((x) => `<tr><td style="${td_()}">${esc_(x.id)}</td><td style="${td_()}">${dataPT_(x.data)}</td><td style="${td_()}">${esc_(x.turma || '—')}</td><td style="${td_()}">${esc_(x.nota || '')}</td></tr>`)
    .join('');
  const tur = (c.turmas || [])
    .map((t) => `<tr><td style="${td_()}"><b>${esc_(t.turma)}</b></td><td style="${td_()}">${t.nao} de ${t.decididas} experiências decididas não converteram</td></tr>`)
    .join('');
  const rec = (c.reclamacoes || [])
    .map((x) => `<tr><td style="${td_()}">nº ${esc_(String(x.numero).padStart(4, '0'))}</td><td style="${td_()}">${esc_(x.tema)}</td><td style="${td_()}">${dataPT_(x.recebida)}</td><td style="${td_()}">${esc_(x.estado)}</td><td style="${td_()}">${linkRecl_(x.token)}</td></tr>`)
    .join('');
  const rt = c.resumoTecnicas || {};
  const resumo = rt.total
    ? `<p style="margin:16px 0 6px;font-weight:600">Reclamações de origem técnica nesta época</p>
      <p style="margin:0 0 4px"><b>${rt.total}</b> ${rt.total === 1 ? 'reclamação' : 'reclamações'} até agora${rt.abertas ? `, ${rt.abertas} em aberto` : ', todas concluídas'}.</p>
      ${(rt.temas || []).length ? `<p style="margin:0;color:#5B6577;font-size:13px">Mais mencionados: ${rt.temas.map((t) => `${esc_(t.tema)} (${t.n})`).join(' · ')}</p>` : ''}`
    : '';
  return moldura_(`
    <p style="margin:0 0 14px">Olá,</p>
    <p style="margin:0 0 14px">Para acompanhamento técnico na <b>${esc_(c.escola)}</b>:</p>
    ${resumo}
    ${rec ? `<p style="margin:16px 0 6px;font-weight:600">Reclamações de temas técnicos em aberto</p>
      <table style="border-collapse:collapse;width:100%;font-size:13px"><tr>${['Reclamação', 'Tema', 'Recebida', 'Estado', ''].map((h) => `<th style="${th_()}">${h}</th>`).join('')}</tr>${rec}</table>
      <p style="margin:6px 0 0;color:#5B6577;font-size:12.5px">Abre cada uma para ver o que aconteceu, onde e o contexto.</p>` : ''}
    ${tec ? `<p style="margin:16px 0 6px;font-weight:600">Experiências que não converteram por motivo técnico</p>
      <table style="border-collapse:collapse;width:100%;font-size:13px"><tr>${['Código', 'Data', 'Turma/equipa', 'Detalhe do operacional'].map((h) => `<th style="${th_()}">${h}</th>`).join('')}</tr>${tec}</table>` : ''}
    ${tur ? `<p style="margin:18px 0 6px;font-weight:600">Turmas/equipas com muitas experiências não convertidas</p>
      <table style="border-collapse:collapse;width:100%;font-size:13px">${tur}</table>` : ''}
    <p style="margin:18px 0 0;color:#5B6577;font-size:13px">Os números completos estão na app, em Inscritos › Experiências.</p>
  `);
}

function assuntoGeral_(g) {
  const a = (g.atencao || []).length;
  const d = (g.destaque || []).length;
  return `Dragon Force · Resumo semanal da rede: ${a} ${a === 1 ? 'ponto de atenção' : 'pontos de atenção'}, ${d} em destaque`;
}

function agrupar_(lista) {
  const m = {};
  (lista || []).forEach((x) => (m[x.escola] = (m[x.escola] || []).concat(x.texto)));
  return Object.keys(m).sort().map((e) => ({ escola: e, textos: m[e] }));
}

function blocoEscolas_(titulo, lista, cor, vazio) {
  const g = agrupar_(lista);
  const corpo = g.length
    ? g.map((x) => `<tr><td style="${td_()};width:34%"><b>${esc_(x.escola)}</b></td><td style="${td_()}">${x.textos.map((t) => `<div style="margin:0 0 3px">${esc_(t)}</div>`).join('')}</td></tr>`).join('')
    : `<tr><td style="${td_()};color:#5B6577">${vazio}</td></tr>`;
  return `<p style="margin:18px 0 6px;font-weight:700;color:${cor}">${titulo}</p>
    <table style="border-collapse:collapse;width:100%;font-size:13px;border-top:2px solid ${cor}">${corpo}</table>`;
}

function htmlGeral_(g) {
  const r = g.rede || {};
  const a = (g.atencao || []).length;
  const abertas = (g.abertas || g.tecnicas || []);
  const nAtras = abertas.filter((x) => x.estado === 'atrasada').length;
  const link = g.painel ? `${URL_APP}/?op=${encodeURIComponent(g.painel)}` : '${URL_APP}';
  return moldura_(`
    <p style="margin:0 0 14px">Olá,</p>
    <p style="margin:0 0 6px">O resumo semanal da rede está no dashboard, com a mesma informação de sempre: inscritos, desistências, conversão das experiências, escolas que precisam de atenção, escolas em destaque e reclamações em andamento.</p>
    <p style="margin:0 0 18px;color:#5B6577;font-size:13px">Esta semana: ${r.inscritos != null ? `${r.inscritos} inscritos` : 'inscritos na app'} · ${a} ${a === 1 ? 'ponto de atenção' : 'pontos de atenção'} · ${abertas.length} ${abertas.length === 1 ? 'reclamação em andamento' : 'reclamações em andamento'}${nAtras ? ` (${nAtras} ${nAtras === 1 ? 'atrasada' : 'atrasadas'})` : ''}.</p>
    <p style="margin:0 0 6px"><a href="${link}" style="display:inline-block;background:#0B2A5B;color:#fff;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:9px">Abrir o dashboard</a></p>
    <p style="margin:14px 0 0;color:#5B6577;font-size:12.5px">O link é pessoal da rede e fica ativo durante 30 dias.</p>
  `);
}

function linkRecl_(token) {
  return `<a href="${URL_APP}/?op=${encodeURIComponent(token)}" style="color:#0B2A5B;font-weight:600">Abrir</a>`;
}

function moldura_(conteudo) {
  return `<div style="background:#F3F5F9;padding:24px 12px;font-family:Arial,Helvetica,sans-serif;color:#0F1B2D">
    <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:14px;overflow:hidden;border:1px solid #E3E7EE">
      <div style="background:#0B2A5B;color:#fff;padding:14px 22px;font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase">FC Porto · Dragon Force · Gestão da Qualidade</div>
      <div style="padding:22px;font-size:14.5px;line-height:1.5">${conteudo}</div>
    </div>
    <div style="max-width:560px;margin:10px auto 0;font-size:11.5px;color:#8A93A3;text-align:center">E-mail automático da app de qualidade. Para dúvidas, responde a este e-mail.</div>
  </div>`;
}
const th_ = () => 'text-align:left;padding:6px 8px;border-bottom:2px solid #0B2A5B;font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:#5B6577';
const td_ = () => 'padding:6px 8px;border-bottom:1px solid #E3E7EE;vertical-align:top';
function esc_(t) {
  return String(t == null ? '' : t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}
function dataPT_(iso) {
  const s = String(iso || '');
  return s.length >= 10 ? `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}` : s;
}


// Assunto e HTML do e-mail tal como o script o envia. dados vem de op_previa.
export function previaEmail(tipo, d) {
  if (tipo === "operacional") return { assunto: assuntoOperacional_(d), html: htmlOperacional_(d) };
  if (tipo === "coordenador") return { assunto: `Dragon Force · ${d.escola}: acompanhamento técnico`, html: htmlCoordenador_(d) };
  if (tipo === "geral") return { assunto: assuntoGeral_(d), html: htmlGeral_(d) };
  return null;
}
