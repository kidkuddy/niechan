/* ============================================================
   script.js — the dialogue graph, authored as pure DATA.

   The whole visual novel is a map of nodes. The engine (vn.js) walks
   it; nothing here touches the DOM or the avatar. Keeping the graph as
   data is deliberate: a later ticket can slot AI-generated answer nodes
   or brand-new routes in here without rewriting the engine.

   line fields:
     jp     — Japanese, shown on the box and spoken by the pre-baked voice
     en     — English subtitle
     emote  — expression preset the avatar holds for the line
              (happy | relaxed | neutral | surprised | sad)
     react  — if true, play a short vocal gasp before the line
     audio  — override text for the pre-recorded voice. Required when jp
              contains {name}: the recorded clip says a generic greeting
              while the box interpolates the visitor's name.
   ============================================================ */

export function S(jp, en, emote, opts) {
  opts = opts || {};
  return { jp, en, emote: emote || 'neutral', react: !!opts.react, audio: opts.audio || null };
}

export const RANDOM_NAMES = ['Senpai', 'Recruiter-san', '謎の訪問者', 'Anon-kun', 'HR-sama'];
export const REACTIONS = ['ええっ？！', 'うわっ！', 'はあ？！', 'うそでしょ？！', 'びっくりした！'];

export const SCRIPT = {
  intro: {
    lines: [
      S('こんにちは！来てくれてありがとう！', 'Hi there! Thanks for coming!', 'happy'),
      S('私はニーちゃん！このポートフォリオの案内人だよ。', "I'm Nie-chan! The guide of this portfolio.", 'relaxed'),
    ],
    next: 'askname',
  },
  askname: {
    lines: [S('えっと……あなたのお名前は？', "Umm... what's your name?", 'neutral')],
    action: 'askname',
  },
  greet: {
    lines: [
      S('{name}さん、ようこそ！', 'Welcome, {name}!', 'happy', { audio: 'いらっしゃい、ようこそ！' }),
      S('今日はね、モハメッド・ソフィエン・バルカっていうエンジニアを紹介するよ！',
        "Today I'll introduce you to an engineer called Mohamed Sofiene Barka!", 'happy'),
    ],
    next: 'tonepick',
  },
  tonepick: {
    lines: [S('その前に……どんな案内がいい？', 'Before that... how should I guide you?', 'neutral')],
    choices: [
      { jp: '丁寧にお願いします', en: 'Politely, please', set: { tone: 'polite' }, goto: 'tone_polite' },
      { jp: '楽しくいこう！', en: "Let's have fun!", set: { tone: 'fun' }, goto: 'tone_fun' },
    ],
  },
  tone_polite: {
    lines: [S('かしこまりました。それでは、ご案内いたします。', 'Understood. Then allow me to guide you properly.', 'relaxed')],
    next: 'hub',
  },
  tone_fun: {
    lines: [S('やった！そうこなくっちゃ！', "Yay! That's the spirit!", 'happy')],
    next: 'hub',
  },

  hub: { lines: [S('何が知りたい？', 'What would you like to know?', 'neutral')], hub: true },
  hub_return: { lines: [S('他に知りたいことある？', 'Anything else you want to know?', 'relaxed')], hub: true },

  /* ---- experience ---- */
  exp1: {
    lines: [
      S('今はね……なんと、二つの会社で同時に働いてるの！', 'Right now... he works at TWO companies at the same time!', 'surprised', { react: true }),
      S('Callab AI——Yコンビネーターのスタートアップと、Clusterlab！信じられる？',
        'Callab AI — a Y Combinator startup — and Clusterlab! Can you believe it?', 'surprised'),
    ],
    choices: [
      { jp: '過去の仕事も全部聞かせて！', en: 'Tell me ALL the past jobs!', goto: 'exp2' },
      { jp: '二つも？！大丈夫なの？', en: 'TWO?! Is he okay??', goto: 'exp_worry' },
      { jp: 'なるほど、他のことを聞こう', en: "I see — let's talk about something else", goto: 'hub_return' },
    ],
  },
  exp_worry: {
    lines: [
      S('ふふ……彼曰く、「高可用性の原則を自分の雇用に適用した」んだって。',
        'Hehe... he says he "applied high-availability principles to his own employment."', 'relaxed'),
      S('単一障害点なし！……らしいよ。', 'No single point of failure! ...Apparently.', 'happy'),
    ],
    next: 'exp2',
  },
  exp2: {
    lines: [
      S('Think-itでは、AWSの上にAIサービスのインフラを作ってたの。その前はLambdaをいっぱい書いてたよ。',
        'At Think-it he built infrastructure for AI services on AWS. Before that, he wrote a LOT of Lambdas.', 'neutral'),
      S('PCPコンサルティングではKubernetesのことを考えて、VneuronではSREをやってた。「バイナリを高可用に」だって。',
        'At PCP Consulting he thought about Kubernetes, and at Vneuron he was an SRE. "Making binaries highly available," he says.', 'relaxed'),
      S('Talanでは、仕事しながらブロックチェーンを覚えて、そのままリードしちゃった。',
        'At Talan he learned blockchain ON the job... and then led the initiative.', 'surprised'),
      S('最初の仕事はStreet Car Hub。全部で9つのロール、8年間！', 'His first job was Street Car Hub. Nine roles in eight years!', 'happy'),
    ],
    next: 'hub_return',
  },

  /* ---- cka / skills ---- */
  cka1: {
    lines: [
      S('本当だよ！Certified Kubernetes Administrator——CKA持ち！', "It's true! He's a Certified Kubernetes Administrator — CKA holder!", 'happy'),
      S('vLLMもLangGraphも使えるの。AIのインフラが得意分野だね。', 'He works with vLLM and LangGraph too. AI infrastructure is his thing.', 'relaxed'),
      S('あとね……スキル欄に「オーラ・ファーミング」って書いてあった。', 'Also... his skill list says "Aura Farming."', 'neutral'),
    ],
    choices: [
      { jp: 'オーラ・ファーミングって何？', en: 'What is aura farming?', goto: 'aura' },
      { jp: 'ふーん、次いこ', en: 'Huh. Moving on', goto: 'hub_return' },
    ],
  },
  aura: {
    lines: [
      S('……私にも分からない。', "...I don't know either.", 'sad'),
      S('でも有効化されてるし、無効化できないんだって。仕様らしいよ。', "But it's enabled, and it can't be disabled. Apparently it's by design.", 'relaxed'),
    ],
    next: 'hub_return',
  },

  /* ---- education ---- */
  edu1: {
    lines: [
      S('INSATっていうチュニジアの工科大学で、ICTエンジニアリングを勉強したの。', 'He studied ICT Engineering at INSAT, an engineering school in Tunisia.', 'neutral'),
      S('そして今は——博士課程！働きながらだよ？！', 'And now — a PhD! While working?!', 'surprised', { react: true }),
      S('二つの仕事と、博士号と……', 'Two jobs, and a doctorate, and...', 'neutral'),
      S('……ちゃんと寝てるのかな。', '...I hope he actually sleeps.', 'sad'),
    ],
    next: 'hub_return',
  },

  /* ---- languages ---- */
  lang1: {
    lines: [
      S('こんにちは！ Hello! Hallo! Привет! Bonjour!', 'Konnichiwa! Hello! Hallo! Privet! Bonjour!', 'happy'),
      S('アラビア語が母語で、英語、ドイツ語、ロシア語、フランス語！すごいでしょ。',
        'Arabic is his native tongue, plus English, German, Russian and French! Impressive, right?', 'relaxed'),
    ],
    next: 'hub_return',
  },

  /* ---- award ---- */
  award1: {
    lines: [
      S('あるよ！TICAD8イノベーションチャレンジで受賞したの！', 'He does! He won at the TICAD8 Innovation Challenge!', 'happy'),
      S('チュニスで開かれた国際的なやつだよ。えっへん。', 'An international one, held in Tunis. *proud noises*', 'relaxed'),
    ],
    next: 'hub_return',
  },

  /* ---- the secret: who is Nie-chan ---- */
  secret1: {
    lines: [
      S('私……？', 'Me...?', 'surprised'),
      S('私はニーちゃん。彼のGitHubの名前、「Nie-Mand」から生まれたの。', "I'm Nie-chan. I was born from his GitHub name — \"Nie-Mand.\"", 'neutral'),
      S('ドイツ語で「誰でもない」っていう意味。', 'It means "nobody" in German.', 'relaxed'),
      S('どの会社も、仕事が完了したことを認めてる。でも全部——「誰でもない」がやったの。ふふ。',
        'Every employer confirms the work was done. But all of it... was done by Nobody. Hehe.', 'happy'),
    ],
    next: 'hub_return',
  },

  /* ---- ending: hand over the contact card ---- */
  end1: {
    lines: [
      S('やったー！！それが一番聞きたかった！', "YESSS!! That's what I was hoping you'd say!", 'happy', { react: true }),
      S('じゃあ、連絡先を渡すね。', 'Then let me hand you his contact card.', 'relaxed'),
    ],
    action: 'showContact',
    next: 'end2',
  },
  end2: {
    lines: [
      S('来てくれて本当にありがとう、{name}さん。', 'Thank you so much for visiting, {name}.', 'happy', { audio: '来てくれて本当にありがとう！' }),
      S('またね！', 'See you again!', 'happy'),
    ],
    choices: [
      { jp: 'もう少し話す', en: 'Talk a bit more', goto: 'hub_return', keepCard: true },
      { jp: '最初から', en: 'Restart', goto: 'restart' },
    ],
  },
};

/* Hub menu. `contact` and `secret` are always offered so the visitor can
   always reach the contact card (acceptance) or unravel the "Nobody" gag. */
export const HUB_CHOICES = [
  { jp: '経歴を教えて！', en: "What's his experience?", goto: 'exp1' },
  { jp: 'CKA持ってるって本当？', en: 'Does he really have the CKA?', goto: 'cka1' },
  { jp: '学歴は？', en: 'What about education?', goto: 'edu1' },
  { jp: '何ヶ国語話せるの？', en: 'How many languages does he speak?', goto: 'lang1' },
  { jp: '受賞歴はある？', en: 'Any awards?', goto: 'award1' },
  { jp: 'ところで……あなたは誰？', en: 'Wait... who are YOU?', goto: 'secret1' },
  { jp: '彼と話したい！連絡先を！', en: 'I want to reach him — the contact card!', goto: 'end1', primary: true },
];

/* ---- spoken-text + audio-key helpers ----
   These MUST reproduce the exact filenames of the pre-baked VOICEVOX
   clips in audio/, so the mapping (djb2 hash of the cleaned Japanese)
   is intentionally identical to the one that generated them. */
export function cleanSpoken(text) {
  return text.replace(/[「」『』——]/g, '');
}

export function audioText(line) {
  if (line.audio) return cleanSpoken(line.audio);
  if (line.jp.indexOf('{name}') !== -1) return null; // dynamic name → no pre-baked clip
  return cleanSpoken(line.jp);
}

export function lineKey(text) {
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) >>> 0;
  return ('0000000' + h.toString(16)).slice(-8);
}
