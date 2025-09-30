// 1) IMPORTS
const express = require('express');
const { Client, LocalAuth, List } = require('whatsapp-web.js');
const fs = require('fs');
const path = require('path');
const os = require('os');
const puppeteer = require('puppeteer');
const QRCode = require('qrcode');
const qrcodeTerminal = require('qrcode-terminal');

// 2) ESTADO
let latestQR = null;
let latestQRAt = null;
let isReady = false;

// (opcional) URL pública p/ logar link do QR no console
const PUBLIC_URL =
  process.env.PUBLIC_URL ||
  (process.env.KOYEB_PUBLIC_DOMAIN ? `https://${process.env.KOYEB_PUBLIC_DOMAIN}` : '');

// 3) EXPRESS: app + rotas + listen
const app = express();
const PORT = Number(process.env.PORT) || 3000;

// helper de no-cache
const noCache = (res) => {
  res.set('Cache-Control','no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma','no-cache');
  res.set('Expires','0');
  res.set('Surrogate-Control','no-store');
};

// Home: “Chatbot online!” + QR quando disponível
app.get('/', (_req, res) => {
  const hasQR = Boolean(latestQR);
  const waitingQR = !hasQR && !isReady; // inicializando/gerando QR

  if (hasQR || waitingQR) noCache(res);
  const refresh = (hasQR || waitingQR) ? '<meta http-equiv="refresh" content="5">' : '';

  const rightCol = hasQR ? '<img src="/qr.png" alt="QR WhatsApp" />' : '';
  const info = hasQR
    ? 'Escaneie o QR para conectar ao WhatsApp.'
    : (isReady ? 'Já conectado ao WhatsApp ✅' : 'Gerando QR… aguarde alguns segundos.');

  const links = hasQR
    ? 'Prefere <a href="/qr-plain" target="_blank">tela cheia</a> ou <a href="/qr.svg" target="_blank">SVG</a>?'
    : (isReady ? 'Se desconectar, um novo QR aparecerá aqui automaticamente.' : '');

  res.type('html').send(`<!doctype html>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
${refresh}
<title>Chatbot online</title>
<style>
  :root { --pad: 24px; }
  html,body{height:100%;margin:0;background:#fff;font-family:system-ui,Segoe UI,Roboto,Helvetica,Arial,sans-serif}
  .page{min-height:100%;display:flex;align-items:center;justify-content:center;padding:var(--pad)}
  .card{display:grid;gap:16px;grid-template-columns: 1fr ${hasQR ? 'auto' : '1fr'};align-items:center;max-width:980px;width:100%}
  h1{margin:0 0 8px 0;font-size:28px}
  p{margin:8px 0 0 0}
  img{width:360px;height:360px;image-rendering:pixelated}
  .links{opacity:.75;margin-top:8px}
</style>
<div class="page">
  <div class="card">
    <div>
      <h1>🤖 Chatbot online!</h1>
      <p>${info}</p>
      ${links ? `<p class="links">${links}</p>` : ''}
    </div>
    ${rightCol}
  </div>
</div>`);
});

// QR puro em SVG
app.get('/qr.svg', async (_req, res) => {
  try {
    if (!latestQR) return res.status(204).end();
    noCache(res);
    const svg = await QRCode.toString(latestQR, { type:'svg', width:360, margin:4, errorCorrectionLevel:'M' });
    res.type('image/svg+xml').send(svg);
  } catch {
    res.status(500).send('Falha ao gerar QR');
  }
});

// QR puro em PNG
app.get('/qr.png', async (_req, res) => {
  try {
    if (!latestQR) return res.status(204).end();
    noCache(res);
    const buf = await QRCode.toBuffer(latestQR, { type:'png', width:360, margin:4, errorCorrectionLevel:'M' });
    res.type('image/png').send(buf);
  } catch {
    res.status(500).send('Falha ao gerar QR');
  }
});

// Página fullscreen com auto-refresh
app.get('/qr-plain', (_req, res) => {
  if (!latestQR) return res.send('<!doctype html><meta charset="utf-8"><h1>Já conectado ✅</h1>');
  noCache(res);
  res.type('html').send(`<!doctype html>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="refresh" content="5"><title>QR do WhatsApp</title>
<style>html,body{height:100%;margin:0;background:#fff}.wrap{display:flex;align-items:center;justify-content:center;height:100%}img{max-width:92vmin;max-height:92vmin;image-rendering:pixelated}</style>
<div class="wrap"><img src="/qr.png" alt="QR WhatsApp"></div>`);
});

// Diagnóstico rápido
app.get('/status', (_req, res) => {
  res.json({ isReady, hasQR: Boolean(latestQR), latestQRAt, now: new Date() });
});

// **APENAS UMA** vez:
app.listen(PORT, () => console.log(`Health-check na porta ${PORT}`));

// 4) WHATSAPP WEB.JS: perfil tempor., DATA_PATH, client, listeners, initialize
const tmpProfile = path.join(os.tmpdir(), 'wwebjs_tmp_profile');
try { fs.rmSync(tmpProfile, { recursive:true, force:true }); } catch {}

const DATA_PATH = process.env.WWEBJS_DATA_PATH || path.join(process.cwd(), '.wwebjs_auth');

const client = new Client({
  authStrategy: new LocalAuth({ dataPath: DATA_PATH, clientId: 'default' }),
  puppeteer: {
    headless: true,
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || puppeteer.executablePath(),
    args: [
      '--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage',
      '--disable-gpu','--no-zygote','--no-first-run','--no-default-browser-check',
      `--user-data-dir=${tmpProfile}`
    ],
    timeout: 90000
  }
});

// ===== Listeners =====
client.on('qr', (qr) => {
  latestQR = qr;
  latestQRAt = new Date();
  isReady = false;
  console.log('[QR] Aguardando leitura...');
  if (PUBLIC_URL) console.log(`[QR] Abra: ${PUBLIC_URL}/qr-plain`);
  try { qrcodeTerminal.generate(qr, { small:true }); } catch {}
});

client.on('ready', () => {
  console.log('[READY] WhatsApp conectado');
  latestQR = null;
  isReady = true;
});

client.on('auth_failure', (m) => console.error('[AUTH_FAILURE]', m));
client.on('disconnected', (r) => {
  console.error('[DISCONNECTED]', r);
  isReady = false;
});

// **APENAS UMA** vez:
client.initialize();

// ===== Utils (se quiser usar em outras partes) =====
const delay = (ms) => new Promise((res) => setTimeout(res, ms));
const typing = async (chat, ms = 1200) => { await chat.sendStateTyping(); await delay(ms); };
const firstName = v => (v ? String(v).trim().split(/\s+/)[0] : '');



// ===== Cards / Textos =====
const menuText = (nome = '') => 
`Olá ${firstName(nome)}! 👋

Seja bem-vindo(a) à família Madala CF! 💪\n\nCom 10 anos de mercado, levamos a sério o compromisso que assumimos com você.\n
Sua saúde e seu bem-estar são nossa prioridade.\n\n

Escolha uma opção para descobrir mais sobre a Madala CF (envie o número):\n
1 - 🏋️ Como funcionam as aulas de CrossFit\n
2 - 🥋 Aulas de judô com o Sensei Jeferson (todos os dias)\n
3 - 🌐 Redes sociais da Madala CF\n
4 - 🏆 Eventos da Madala CF\n
0 - ☎ Falar com o Tchê (gerente-geral)
`;

function cfPosMenu(nome = '') {
  const n = (typeof firstName === 'function' ? firstName(nome) : (nome || '').trim().split(' ')[0]);
  const prefixo = n ? `${n}, ` : '';
  return `${prefixo}Escolha uma opção (digite a palavra):
• *Mais*   → 📊 Planos e valores
• *Marcar* → 🗓️ Agendar sua aula experimental
• *Menu*   → 🔙 Voltar ao menu inicial
• *Sair*   → ❌ Encerrar conversa`;
}

function menu_rápido(nome = '') {
  const n = (typeof firstName === 'function' ? firstName(nome) : (nome || '').trim().split(' ')[0]);
  const prefixo = n ? `${n}, ` : '';
  return `${prefixo}Escolha uma opção (digite a palavra):
• *Menu*   → 🔙 Voltar ao menu inicial
• *Sair*   → ❌ Encerrar conversa`;
}


function menu_agendamento(nome = '') {
  const n = (typeof firstName === 'function' ? firstName(nome) : (nome || '').trim().split(' ')[0]);
  const prefixo = n ? `${n}, ` : '';
  return `${prefixo}Escolha uma opção (digite a palavra):
• *Marcar* → 🗓️ Agendar sua aula experimental
• *Menu*   → 🔙 Voltar ao menu inicial
• *Sair*   → ❌ Encerrar conversa`;
}


const RESPOSTAS = {
  comoFunciona: (nome = '') => {
    const n = (typeof firstName === 'function' ? firstName(nome) : (nome || '').trim().split(/\s+/)[0]);
    const titulo = `*COMO FUNCIONA O CROSSFIT${n ? `, ${n}` : ''}?*`;
    return `${titulo}

• Estamos abertos de seg. a sáb., das 6h às 21h.
• Treinos em grupo, com coach supervisionando a turma (todos os níveis).
• Aula com aquecimento.
• Escalas: Iniciante, Intermediário e Avançado.
• Avaliação inicial para ajustar cargas e movimentos.\n

📍 Localização: https://maps.app.goo.gl/nyDBAPzNLLBHYWMJ9\n

Bora fazer uma aula experimental? 💪\n
✅ Agende sua aula:
https://calendar.app.google/9r6mFZTPwUivm4x89\n`;
  },


planos: (nome = '') => {
  const n = (typeof firstName === 'function' ? firstName(nome) : (nome || '').trim().split(/\s+/)[0]);
  const titulo = n
    ? `*Bora, ${n}, escolher seu plano?* (CrossFit Premium)`
    : `*Bora escolher seu plano?* (CrossFit Premium)`;

  return `${titulo}
💰 Trimestral: R$ 510/mês
💰 Semestral: R$ 440/mês
💰 Anual: R$ 360/mês\n

Formas de pagamento: cartão, PIX e boleto.\n`;
},

agendarCrossfit: (nome = '') => {
  const n = (typeof firstName === 'function' ? firstName(nome) : (nome || '').trim().split(/\s+/)[0]);
  return `🗓️ *Agende sua aula experimental de CrossFit*
${n ? `${n}, ` : ''}escolha seu melhor horário no link:
https://calendar.app.google/9r6mFZTPwUivm4x89\n`;
},


Modalidade_judo: `*Judô* 🥋\n
Venha${(typeof n !== 'undefined' && n) ? `, ${n},` : ''} aprender judô com o *Sensei Jeferson* na Madala CF! 👊\n
• Aulas todos os dias, às 21h (duração: 1h).\n
• Instrutor: *Sensei Jeferson*.\n
• Mensalidade: R$ 150,00.\n
• Turmas para todos os níveis (iniciante ao avançado).\n
\n\nQuer sentir a energia do tatame? 💥\n
✅ Agende sua aula experimental:\nhttps://calendar.google.com/calendar/u/0/r/month/2025/9/24`,

Eventos_madalacf: `*Eventos*\nFique por dentro${(typeof n !== 'undefined' && n) ? `, ${n},` : ''} do que rola na Madala CF:\n\n
• Torneios internos e abertos (CrossFit e Judô).
• Workshops e palestras com profissionais renomados.
• Aulas especiais temáticas.
• Encontros sociais e confraternizações.\n\n
Participe e fortaleça nossa comunidade! 🤝\n
📅 Mais detalhes e inscrições no link:\n
https://calendar.google.com/calendar/u/0/r/month/2024/6/1`,


atendente: `Este é o contato do *Tchê* (gerente-geral) 👨‍💼\n
${(typeof n !== 'undefined' && n) ? `${n}, ` : ''}Pronto para te ajudar com qualquer dúvida ou suporte.\n\n

WhatsApp: https://wa.me/qr/LI5TG3DW5XAZF1\n\n
Envie uma mensagem e aguarde um momento para o retorno.`,


  Redes_sociais: `*REDES SOCIAIS MADALA CF* 📱
📸 Instagram:  @madalaCF - https://www.instagram.com/madalacf/
👍 Facebook:   Madala_CF - https://www.facebook.com/madalacf/?locale=pt_BR
🌐 Site:       Page_mada -https://madalacf.com.br`
};

// ===== Estado simples por chat =====
const estado = {}; // { [chatId]: 'MAIN' | 'CF_MENU' }

// ===== Menu (List) com fallback =====
async function enviarMenu(msg, chat, nome) {
  await typing(chat);

  // (1) Fallback em texto (funciona em qualquer dispositivo)
  await client.sendMessage(msg.from, menuText(nome));

  // (2) Tenta enviar o List (melhor UX no celular)
  try {
    const sections = [{
      title: 'Menu principal',
      rows: [
        { id: '1', title: '1 - 🏋️ Como funcionam as aulas de CrossFit' },
        { id: '2', title: '2 - 🥋 Aulas de judô com Sensei Jeferson todos os dias.' },
        { id: '3', title: '3 - 🌐 Redes sociais Madala CF' },
        { id: '4', title: '4 - 🏆 Eventos Madala CF' },
        { id: '0', title: '0 - ☎ Falar com Tchê (gerente geral)' },
      ],
    }];
    const list = new List('Toque em "Ver opções" para abrir a lista.', 'Ver opções', sections, 'Madala CF', 'Ou digite o número aqui.');
    await client.sendMessage(msg.from, list);
  } catch (e) {
    console.warn('List não enviado (seguindo apenas com o texto do menu).', e?.message || e);
  }
}

// ===== Router principal (UM ÚNICO listener) =====
client.on('message', async (msg) => {
  try {
    // Ignora grupos/status
    if (!msg.from.endsWith('@c.us')) return;

    const chat    = await msg.getChat();
    const contact = await msg.getContact();
    const nome    = contact.pushname || contact.name || contact.shortName || contact.number || '';
    const chatId  = msg.from;

    // Normalização
    const rawText   = (msg.body || '').toString().trim();
    const lowerText = rawText.toLowerCase();
    let   asciiText = lowerText.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    // Se a mensagem for resposta de List, use o id da linha para rotear (fica '1','2','3','4','0')
    if (msg.type === 'list_response' && msg.selectedRowId) {
      asciiText = String(msg.selectedRowId).trim().toLowerCase();
    }

    // Gatilho de saudação/menu → abre o menu inicial
    const ehSaudacao = /(menu|dia|tarde|noite|oi|ola|olá|oie|hey|eai)/i.test(asciiText);
    if (ehSaudacao) {
      estado[chatId] = 'MAIN';          // reseta estado
      await enviarMenu(msg, chat, nome);
      return;
    }

    // Estado atual
    const st = estado[chatId] || 'MAIN';

    // ===== MAIN (menu principal) =====
    if (st === 'MAIN') {
      
                        // 1) CrossFit → "Como funciona" + pós-menu C
                        if (/^\s*mais\b/.test(lowerText)) {
                          await typing(chat);
                          const planosMsg = (typeof RESPOSTAS?.planos === 'function') ? RESPOSTAS.planos(nome) : RESPOSTAS.planos;
                          if (planosMsg) await client.sendMessage(chatId, planosMsg);

                          await typing(chat);
                          const agendaMsg = (typeof RESPOSTAS?.agendarCrossfit === 'function') ? RESPOSTAS.agendarCrossfit(nome) : RESPOSTAS.agendarCrossfit;
                          if (agendaMsg) await client.sendMessage(chatId, agendaMsg);
                          return;
                        } else if (/^\s*marcar\b/.test(lowerText)) {
                          await typing(chat);
                          const agendaMsg = (typeof RESPOSTAS?.agendarCrossfit === 'function') ? RESPOSTAS.agendarCrossfit(nome) : RESPOSTAS.agendarCrossfit;
                          if (agendaMsg) await client.sendMessage(chatId, agendaMsg);
                          return;
                        // menu/sair se quiser:
                        } else if (/^\s*menu\b/.test(lowerText)) {
                          await typing(chat);
                          await client.sendMessage(chatId, menu_rápido(nome)); // ou menu_rápido('')
                          return;
                        } else if (/^\s*sair\b/.test(lowerText)) {
                          await typing(chat);
                          await client.sendMessage(chatId, 'Ok! Conversa encerrada. 👋');
                          return;
                        }

                        // --- Depois as opções de conteúdo/números ---
                        else if (
                          asciiText === '1' ||
                          lowerText.startsWith('1 - 🏋️') ||
                          /\bcomo funciona\b/.test(lowerText)
                        ) {
                          await typing(chat);
                          const msgComoFunciona = (typeof RESPOSTAS?.comoFunciona === 'function')
                            ? RESPOSTAS.comoFunciona(nome)
                            : RESPOSTAS.comoFunciona;
                          if (msgComoFunciona) await client.sendMessage(chatId, msgComoFunciona);

                          await typing(chat);
                          await client.sendMessage(chatId, cfPosMenu(nome));
                          return;
                        }

                        // 2) Judô
                        if (asciiText === '2' || lowerText.startsWith('2 - 🥋')) {
                          await typing(chat);

                          const judoMsg = (typeof RESPOSTAS?.Modalidade_judo === 'function')
                            ? RESPOSTAS.Modalidade_judo(nome)
                            : RESPOSTAS.Modalidade_judo;

                          if (judoMsg) await client.sendMessage(chatId, judoMsg);

                          await typing(chat);
                          await client.sendMessage(chatId, menu_rápido(nome)); // <- aqui
                          return;
                        }

                        // 3) Redes sociais
                        if (asciiText === '3' || lowerText.startsWith('3 - 🌐')) {
                          await typing(chat);

                          const redesMsg = (typeof RESPOSTAS?.Redes_sociais === 'function')
                            ? RESPOSTAS.Redes_sociais(nome)
                            : RESPOSTAS.Redes_sociais;

                          if (redesMsg) await client.sendMessage(chatId, redesMsg);

                          await typing(chat);
                          await client.sendMessage(chatId, menu_rápido(nome)); // <- aqui
                          return;
                        }

                        // 4) Eventos
                        if (asciiText === '4' || lowerText.startsWith('4 - 🏆')) {
                          await typing(chat);

                          const eventosMsg = (typeof RESPOSTAS?.Eventos_madalacf === 'function')
                            ? RESPOSTAS.Eventos_madalacf(nome)
                            : RESPOSTAS.Eventos_madalacf;

                          if (eventosMsg) await client.sendMessage(chatId, eventosMsg);

                          await typing(chat);
                          await client.sendMessage(chatId, menu_rápido(nome)); // <- aqui
                          return;
                        }

                        // 0) Atendente
                        if (asciiText === '0' || lowerText.startsWith('0 - ☎')) {
                          await typing(chat);

                          const atendenteMsg = (typeof RESPOSTAS?.atendente === 'function')
                            ? RESPOSTAS.atendente(nome)
                            : RESPOSTAS.atendente;

                          if (atendenteMsg) await client.sendMessage(chatId, atendenteMsg);

                          await typing(chat);
                          await client.sendMessage(chatId, menu_rápido(nome)); // <- aqui
                          return;
                        }


      // Fallback no MAIN
      await typing(chat);
      await client.sendMessage(chatId, 'Não entendi. Toque em "Ver opções" ou digite *menu* para abrir o menu.');
      await enviarMenu(msg, chat, nome);
      return;
    }

                  // ===== CF_MENU (pós-menu do CrossFit) =====
                  if (st === 'CF_MENU') {
                    // "mais" → planos
                    if ([  'mais', 'planos', 'plano', 'valores', 'valor',
                            'preco', 'precos', 'mensalidade', 'mensalidades',
                            'pacote', 'pacotes', 'tabela preco', 'tabela de preco', 'tabela de precos',
                            'quanto custa', 'quanto e', 'quanto fica', 'quanto sai',
                            'por mes', 'quanto por mes', 'preco crossfit', 'preco da mensalidade',
                            'investimento', 'mensal', 'trimestral', 'semestral', 'anual',
                'promocao', 'desconto', 'matricula', 'taxa'].includes(asciiText)) {
                      await typing(chat);
                      await client.sendMessage(chatId, RESPOSTAS.planos);
                      await client.sendMessage(chatId, cfPosMenu(nome));  // permanece no CF_MENU
                      return;
                    }

                  // "marcar" → agendamento
                  if ([  'marcar', 'agendar', 'agendamento',
                          'reservar', 'reserva', 'bookar', 'booking',
                          'agenda', 'horario', 'horarios',
                          'disponibilidade', 'disponivel',
                          'vaga', 'vagas', 'encaixe', 'encaixar',
                          'inscricao', 'inscrever', 'matricula', 'matricular',
                          'aula experimental', 'aula teste', 'aula avulsa', 'trial',
                          'drop in', 'drop-in', 'dropin'].includes(asciiText)) {
                    await typing(chat);
                    await client.sendMessage(chatId, RESPOSTAS.agendarCrossfit);
                    await client.sendMessage(chatId, cfPosMenu(nome));
                    return;
                  }

      // "menu"/"inicio" → volta ao menu inicial
      if ([  'menu', 'menu inicial', 'menu principal',
  'inicio', 'tela inicial', 'pagina inicial', 'home',
  'voltar ao menu', 'voltar pro menu', 'voltar p menu', 'voltar p/ menu', 'voltar menu',
  'retornar ao menu', 'retornar pro menu',
  'voltar ao inicio', 'voltar pro inicio', 'voltar p/ inicio', 'voltar p inicio',
  'ir para o menu', 'ir ao menu', 'menu por favor',
  '/menu', '/start', 'start', 'back'
].includes(asciiText)) {
        estado[chatId] = 'MAIN';
        await enviarMenu(msg, chat, nome);
        return;
      }

      // "sair" → encerra (reseta estado)
      if (asciiText === 'sair') {
        await client.sendMessage(chatId, 'Até logo! 👋');
        estado[chatId] = 'MAIN';
        return;
      }

      // Inválido no CF_MENU → reexibe instruções
      await client.sendMessage(chatId, cfPosMenu(nome));
      return;
    }

  } catch (err) {
    console.error('Erro no processamento da mensagem:', err);
  }
});

// ===== EXPRESS / HEALTH / QR WEB =====
const QR_SECRET = process.env.QR_SECRET || '';

function checkQrAuth(req, res, next) {
  if (!QR_SECRET) return next(); // se não definir QR_SECRET, libera acesso
  const bearer = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const token = req.query.token || req.headers['x-qr-token'] || bearer;
  if (token === QR_SECRET) return next();
  return res.status(401).send('Unauthorized');
}


// Exibe o QR no navegador quando disponível
// Acesse: https://SEU_DOMINIO/qr?token=SEU_TOKEN (se definir QR_SECRET)
app.get('/qr', async (req, res) => {
  try {
    if (QR_SECRET && req.query.token !== QR_SECRET) {
      return res.status(401).send('Não autorizado');
    }
    if (!latestQR) {
      return res.status(404).send('Sem QR disponível (já conectado ou aguardando reinício).');
    }
    const dataUrl = await QRCode.toDataURL(latestQR);
    res.type('text/html; charset=utf-8').send(`
      <!doctype html>
      <html>
        <head><meta charset="utf-8"><title>QR WhatsApp</title></head>
        <body style="font-family:system-ui, sans-serif; text-align:center; padding:24px">
          <h2>Escaneie no WhatsApp → Aparelhos conectados → Conectar um aparelho</h2>
          <p>Gerado em: ${latestQRAt?.toLocaleString('pt-BR') || '-'}</p>
          <img src="${dataUrl}" alt="QR WhatsApp" style="max-width:360px; width:100%; height:auto;"/>
        </body>
      </html>
    `);
  } catch (e) {
    console.error('[QR_ROUTE_ERROR]', e);
    res.status(500).send('Falha ao gerar/exibir o QR.');
  }
});


// Logs de erros não tratados
process.on('unhandledRejection', (e) => console.error('UnhandledRejection:', e));
process.on('uncaughtException', (e) => console.error('UncaughtException:', e));
