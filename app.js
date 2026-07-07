/* ============================================================
   星詠ノ書 — HOSHIYOMI AI FORTUNE ATELIER
   鑑定エンジン（完全ローカル動作・APIキー不要）
   名前×生年月日から決定論的に鑑定を生成する
   ============================================================ */

"use strict";

/* ---------- シード付き乱数（同じ入力 → 同じ鑑定結果） ---------- */
function xmur3(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return function () {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^= h >>> 16) >>> 0;
  };
}
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ============================================================
   データバンク
   ============================================================ */

/* --- 大アルカナ22枚 --- */
const DECK = [
  { num: "0",    en: "THE FOOL",       name: "愚者",   glyph: "☄", up: ["自由", "新たな旅立ち", "可能性"], rev: ["軽率", "迷走", "準備不足"],
    upMsg: "常識の枠を越えて踏み出す勇気が、思いがけない道をひらきます。", revMsg: "勢いだけで進む前に、足元をもう一度確かめる時です。" },
  { num: "I",    en: "THE MAGICIAN",   name: "魔術師", glyph: "✦", up: ["創造", "才能の開花", "始まり"], rev: ["停滞", "空回り", "迷い"],
    upMsg: "あなたの手の中には、すでに必要な道具が揃っています。", revMsg: "器用さに頼りすぎず、ひとつのことへ集中を取り戻しましょう。" },
  { num: "II",   en: "THE HIGH PRIESTESS", name: "女教皇", glyph: "☽", up: ["直感", "静かな知恵", "洞察"], rev: ["神経質", "思い込み", "秘密"],
    upMsg: "答えはすでに、あなたの内側で静かに灯っています。", revMsg: "情報の波から離れ、心の声が聞こえる静けさを取り戻して。" },
  { num: "III",  en: "THE EMPRESS",    name: "女帝",   glyph: "❋", up: ["豊穣", "愛情", "実り"], rev: ["過保護", "怠惰", "依存"],
    upMsg: "育ててきたものが、ゆっくりと確かな実りに変わっていきます。", revMsg: "与えすぎて自分が枯れていないか、静かに振り返る時です。" },
  { num: "IV",   en: "THE EMPEROR",    name: "皇帝",   glyph: "♔", up: ["安定", "達成", "責任"], rev: ["独断", "頑固", "支配"],
    upMsg: "積み上げた信頼が、揺るがぬ土台となって支えてくれます。", revMsg: "正しさを押し通すより、耳を傾ける強さが求められています。" },
  { num: "V",    en: "THE HIEROPHANT", name: "法王",   glyph: "✠", up: ["導き", "信頼", "助言"], rev: ["形骸化", "束縛", "孤立"],
    upMsg: "信頼できる人の言葉が、迷いを照らす灯になるでしょう。", revMsg: "古い決まりごとが、いまのあなたに合っているか見直しを。" },
  { num: "VI",   en: "THE LOVERS",     name: "恋人",   glyph: "❦", up: ["共鳴", "選択", "結びつき"], rev: ["迷い", "すれ違い", "誘惑"],
    upMsg: "心が自然に向かう方へ。その選択は祝福されています。", revMsg: "天秤にかけ続けるほど、答えは遠ざかります。心はもう知っているはず。" },
  { num: "VII",  en: "THE CHARIOT",    name: "戦車",   glyph: "♆", up: ["前進", "勝利", "突破"], rev: ["暴走", "焦り", "空転"],
    upMsg: "迷わず進んでください。勢いそのものが、いまのあなたの武器です。", revMsg: "アクセルを踏む前に、行き先を定め直す必要があります。" },
  { num: "VIII", en: "STRENGTH",       name: "力",     glyph: "∞", up: ["静かな勇気", "忍耐", "克己"], rev: ["無理", "消耗", "自信喪失"],
    upMsg: "ねじ伏せる力ではなく、受け止める強さがあなたを支えます。", revMsg: "頑張り続けた心と体に、回復の時間を与えてあげてください。" },
  { num: "IX",   en: "THE HERMIT",     name: "隠者",   glyph: "🜂", up: ["内省", "探求", "成熟"], rev: ["閉鎖", "孤独", "過去への執着"],
    upMsg: "ひとりの時間が、誰にも奪えない深い答えを連れてきます。", revMsg: "殻にこもりすぎず、信頼できる一人にだけ扉を開けてみて。" },
  { num: "X",    en: "WHEEL OF FORTUNE", name: "運命の輪", glyph: "◉", up: ["転機", "好機", "流れの変化"], rev: ["タイミングのずれ", "停滞", "逆流"],
    upMsg: "大きな運命の歯車が、いま音もなく回り始めています。", revMsg: "流れに逆らう時ではありません。次の追い風を静かに待ちましょう。" },
  { num: "XI",   en: "JUSTICE",        name: "正義",   glyph: "⚖", up: ["均衡", "誠実", "正当な評価"], rev: ["不均衡", "偏り", "板挟み"],
    upMsg: "誠実に積んだものは、正しく測られ、正しく報われます。", revMsg: "どちらかに傾いた天秤を、一度ゼロに戻す勇気を。" },
  { num: "XII",  en: "THE HANGED MAN", name: "吊るされた男", glyph: "♅", up: ["視点の転換", "献身", "学び"], rev: ["徒労", "我慢の限界", "犠牲"],
    upMsg: "止まって見える時間こそ、世界の見え方が変わる時間です。", revMsg: "その我慢は本当に必要なものか、問い直してよい頃合いです。" },
  { num: "XIII", en: "DEATH",          name: "死神",   glyph: "✝", up: ["再生", "区切り", "変容"], rev: ["未練", "引き延ばし", "停滞"],
    upMsg: "ひとつの章が終わります。それは次の章が始まる合図です。", revMsg: "終わらせる勇気が、新しい扉の鍵になります。" },
  { num: "XIV",  en: "TEMPERANCE",     name: "節制",   glyph: "🜄", up: ["調和", "回復", "ほどよさ"], rev: ["過剰", "アンバランス", "浪費"],
    upMsg: "混ざり合うことで、どちらでもない美しい色が生まれます。", revMsg: "注ぎすぎたコップから、大切なものがこぼれていませんか。" },
  { num: "XV",   en: "THE DEVIL",      name: "悪魔",   glyph: "♄", up: ["執着の自覚", "魅力", "本音"], rev: ["解放", "悪縁の清算", "目覚め"],
    upMsg: "欲も執着も、認めてしまえばあなたを動かす燃料になります。", revMsg: "あなたを縛っていた鎖が、いま静かにほどけ始めています。" },
  { num: "XVI",  en: "THE TOWER",      name: "塔",     glyph: "⚡", up: ["刷新", "覚醒", "古い殻の崩壊"], rev: ["回避", "予兆", "ひび割れ"],
    upMsg: "壊れたのは、もう要らなくなったものだけです。", revMsg: "小さな違和感を見て見ぬふりをしないこと。早めの修繕が吉。" },
  { num: "XVII", en: "THE STAR",       name: "星",     glyph: "✶", up: ["希望", "ひらめき", "癒やし"], rev: ["理想と現実の距離", "失望", "見失い"],
    upMsg: "夜が深いほど、星は鮮やかに輝きます。希望を手放さないで。", revMsg: "遠い理想より、今夜見上げられる星をひとつ見つけましょう。" },
  { num: "XVIII", en: "THE MOON",      name: "月",     glyph: "☾", up: ["夢", "感受性", "潜在意識"], rev: ["不安の霧が晴れる", "誤解の解消", "明晰"],
    upMsg: "曖昧さの中にこそ、言葉にならない大切な真実があります。", revMsg: "霧が晴れていきます。不安の正体は、思ったより小さいものでした。" },
  { num: "XIX",  en: "THE SUN",        name: "太陽",   glyph: "☀", up: ["成功", "生命力", "祝福"], rev: ["曇り空", "自信の揺らぎ", "延期"],
    upMsg: "隠す必要はありません。あなたの輝きは、周りも照らします。", revMsg: "雲の上では、太陽はいつも変わらず輝いています。" },
  { num: "XX",   en: "JUDGEMENT",      name: "審判",   glyph: "♪", up: ["復活", "再会", "決断の時"], rev: ["先送り", "後悔", "聞き逃し"],
    upMsg: "一度諦めたものが、形を変えてもう一度呼んでいます。", revMsg: "心の奥のラッパの音を、もう聞こえないふりをしないで。" },
  { num: "XXI",  en: "THE WORLD",      name: "世界",   glyph: "♁", up: ["完成", "統合", "祝祭"], rev: ["未完", "あと一歩", "マンネリ"],
    upMsg: "長い旅がひとつの円を結びます。完成の祝福を受け取ってください。", revMsg: "完成まであと一歩。最後のピースは、案外足元にあります。" },
  { num: "—",   en: "WHEEL OF STARS", name: "星巡",   glyph: "✧", up: ["縁", "巡り合わせ", "導き"], rev: ["遠回り", "保留", "機が熟すのを待つ"],
    upMsg: "偶然に見える出会いは、星が長くかけて編んだ必然です。", revMsg: "急がば回れ。遠回りの道に、本当の近道が隠れています。" },
];

/* --- 十二星座 --- */
const ZODIAC = [
  { name: "山羊座", en: "CAPRICORN",  glyph: "♑", from: [12,22], to: [1,19],  element: "地", planet: "土星",  trait: "着実に頂を目指す登攀者", essence: "時間を味方につける力" },
  { name: "水瓶座", en: "AQUARIUS",   glyph: "♒", from: [1,20],  to: [2,18],  element: "風", planet: "天王星", trait: "常識を軽やかに越える革新者", essence: "未来を先に生きる視点" },
  { name: "魚座",   en: "PISCES",     glyph: "♓", from: [2,19],  to: [3,20],  element: "水", planet: "海王星", trait: "境界を溶かす共感の人", essence: "見えないものを感じ取る力" },
  { name: "牡羊座", en: "ARIES",      glyph: "♈", from: [3,21],  to: [4,19],  element: "火", planet: "火星",  trait: "迷いなく口火を切る開拓者", essence: "最初の一歩を踏み出す力" },
  { name: "牡牛座", en: "TAURUS",     glyph: "♉", from: [4,20],  to: [5,20],  element: "地", planet: "金星",  trait: "本物だけを見抜く審美眼の人", essence: "豊かさを育てる粘り強さ" },
  { name: "双子座", en: "GEMINI",     glyph: "♊", from: [5,21],  to: [6,21],  element: "風", planet: "水星",  trait: "二つの世界を行き来する伝達者", essence: "言葉と機知で道をひらく力" },
  { name: "蟹座",   en: "CANCER",     glyph: "♋", from: [6,22],  to: [7,22],  element: "水", planet: "月",    trait: "大切なものを守り抜く人", essence: "心の居場所をつくる力" },
  { name: "獅子座", en: "LEO",        glyph: "♌", from: [7,23],  to: [8,22],  element: "火", planet: "太陽",  trait: "存在そのものが光源の人", essence: "堂々と輝き、人を照らす力" },
  { name: "乙女座", en: "VIRGO",      glyph: "♍", from: [8,23],  to: [9,22],  element: "地", planet: "水星",  trait: "細部に宿る神を知る人", essence: "整えることで世界を良くする力" },
  { name: "天秤座", en: "LIBRA",      glyph: "♎", from: [9,23],  to: [10,23], element: "風", planet: "金星",  trait: "美と均衡を司る調停者", essence: "人と人の間に橋を架ける力" },
  { name: "蠍座",   en: "SCORPIO",    glyph: "♏", from: [10,24], to: [11,22], element: "水", planet: "冥王星", trait: "深淵まで潜る探求者", essence: "本質を見抜き、深く結びつく力" },
  { name: "射手座", en: "SAGITTARIUS", glyph: "♐", from: [11,23], to: [12,21], element: "火", planet: "木星",  trait: "地平の向こうを射る冒険者", essence: "楽観と探究で遠くへ行く力" },
];

/* --- 数秘術（ライフパスナンバー） --- */
const NUMEROLOGY = {
  1:  { name: "開拓の一", sub: "先頭に立つ者の数",   essence: "自らの意志で道を切りひらく、生まれながらのパイオニア。誰かの地図ではなく、自分の足跡が道になる人です。", advice: "「決める」ことを恐れないこと。あなたの決断は、後ろに続く人の道しるべになります。" },
  2:  { name: "調和の二", sub: "結ぶ者の数",         essence: "人と人、物事と物事のあいだに立ち、目に見えない橋を架ける人。あなたの「気づき」は周囲の宝です。", advice: "優しさは弱さではありません。NOを言える優しさを身につけると、運が大きくひらきます。" },
  3:  { name: "創造の三", sub: "光をふりまく者の数", essence: "存在そのものが場を明るくする、創造と表現の人。あなたが楽しんでいる時、運は最も強く巡ります。", advice: "完璧より「楽しい」を選ぶこと。遊び心こそ、あなたの最大の開運スイッチです。" },
  4:  { name: "礎の四",   sub: "築く者の数",         essence: "コツコツと積み上げる力において、右に出る者のない建設者。あなたの「当たり前」は、他の人の「特別」です。", advice: "土台を作る人ほど、ときどき空を見上げて。完成図を思い出すと歩みが軽くなります。" },
  5:  { name: "自由の五", sub: "風を運ぶ者の数",     essence: "変化と冒険を糧に成長する、自由の体現者。同じ場所に留まらないことが、あなたの誠実さです。", advice: "飽きっぽさは才能です。ただし「逃げの変化」か「攻めの変化」かだけは見極めて。" },
  6:  { name: "慈愛の六", sub: "抱きとめる者の数",   essence: "愛し、育て、守ることに深い喜びを見出す人。あなたの周りでは、人も植物も、なぜかよく育ちます。", advice: "誰かを満たす前に、自分の杯を満たすこと。あふれた分を注ぐくらいで、ちょうどいいのです。" },
  7:  { name: "探求の七", sub: "真理へ潜る者の数",   essence: "表面では満足できない、生まれついての探求者。ひとりの時間は孤独ではなく、あなたの聖域です。", advice: "考え抜いた答えを、ひとつだけ行動に移すこと。智慧は使われた時にはじめて光ります。" },
  8:  { name: "豊穣の八", sub: "実らせる者の数",     essence: "情熱と実行力で、目に見える成果を生み出す人。大きな目標ほど、あなたの力は引き出されます。", advice: "成果を独り占めしないこと。分かち合うほどに、あなたの器はさらに大きくなります。" },
  9:  { name: "燈火の九", sub: "照らす者の数",       essence: "広い視野と深い共感で、人の心を照らす成熟の数。あなたの一言に救われた人が、必ずいます。", advice: "全員を救おうとしないこと。目の前のひとりを照らせば、光は勝手に広がっていきます。" },
  11: { name: "啓示の十一", sub: "受け取る者の数",   essence: "鋭い直感で、まだ形のないものを感じ取る人。ふと浮かんだ「なんとなく」は、高い精度の羅針盤です。", advice: "直感を疑って捨てないこと。メモに残す習慣が、あなたの才能を現実の力に変えます。" },
  22: { name: "大成の二十二", sub: "形にする者の数", essence: "壮大な理想を、現実の形に変える力を持つ大器。時間がかかるのは、器が大きい証拠です。", advice: "焦らないこと。あなたの人生は長編です。序章の遅さで、物語の価値は決まりません。" },
  33: { name: "無償の三十三", sub: "与える者の数",   essence: "見返りを求めない愛で人を包む、稀有な魂の数。あなたがいるだけで、安心する人がいます。", advice: "自分を後回しにしすぎないこと。あなた自身も、守られるべき大切なひとりです。" },
};

/* --- 守護色（伝統色） --- */
const COLORS = [
  { name: "瑠璃色",   read: "るり",       hex: "#1f4690", sub: "深い信頼と静かな知性の色" },
  { name: "金茶",     read: "きんちゃ",   hex: "#c89932", sub: "実りと豊かさを引き寄せる色" },
  { name: "茜色",     read: "あかね",     hex: "#b13546", sub: "情熱と再起の力を宿す色" },
  { name: "桜鼠",     read: "さくらねず", hex: "#c8a8aa", sub: "張りつめた心をほどく色" },
  { name: "常磐色",   read: "ときわ",     hex: "#1b7b5a", sub: "揺るがぬ継続と健康の色" },
  { name: "藤紫",     read: "ふじむらさき", hex: "#7a5da8", sub: "直感と気品を高める色" },
  { name: "琥珀色",   read: "こはく",     hex: "#bf7c2a", sub: "時間が味方につく色" },
  { name: "月白",     read: "げっぱく",   hex: "#dce4ec", sub: "迷いを照らす月光の色" },
  { name: "若苗色",   read: "わかなえ",   hex: "#8ab35a", sub: "新しい始まりを守る色" },
  { name: "群青色",   read: "ぐんじょう", hex: "#33508c", sub: "心の軸を取り戻す色" },
  { name: "緋色",     read: "ひいろ",     hex: "#cc3b2b", sub: "勝負どきの追い風となる色" },
  { name: "白金",     read: "しろがね",   hex: "#c9ccd4", sub: "縁を清め、整える色" },
];

/* --- 今日の一文（Co-Star風の謎めいた短文） --- */
const ORACLES = [
  "急がなくていい。あなたの番は、ちゃんと取ってあります。",
  "答えを探すのをやめた日に、答えのほうから歩いてきます。",
  "閉じたと思った扉は、施錠されていませんでした。",
  "あなたが手放したものの重さだけ、翼は軽くなっています。",
  "夜のいちばん深いところを、いまあなたは通過しました。",
  "誰にも気づかれない努力を、星はすべて記録しています。",
  "遠回りに見えた道の名前は、のちに「最短距離」と呼ばれます。",
  "そのままのあなたで間に合う未来が、近づいています。",
  "小さな約束をひとつ守ると、大きな流れがひとつ動きます。",
  "迷っているのは、進んでいる証拠です。止まった船は揺れません。",
  "あなたの言葉を待っている人が、ひとりいます。",
  "満ちる前の月が、いちばん多くの光を集めています。",
];

/* --- ラッキーアイテム --- */
const ITEMS = [
  "硝子のペン", "白い封筒", "丸い鏡", "新しい手帳", "銀のスプーン",
  "押し花の栞", "青いインク", "陶器のカップ", "古い文庫本", "麻のハンカチ",
  "鍵のチャーム", "木の櫛", "小さな鈴", "星のモチーフ", "蜂蜜",
];

/* --- 相談ジャンル別テキスト --- */
const TOPICS = {
  total: {
    label: "総合運",
    empathy: [
      "いまのあなたは、大きな節目の気配を感じながらも、それが何なのか、まだ言葉にできずにいるのではないでしょうか。はっきりした悩みではないけれど、このままでいいのかという静かな問いが、胸の奥で灯りつづけている——星々は、そんなあなたの揺らぎを映し出しています。",
      "日々を丁寧にこなしながらも、ふとした瞬間に「私の本当の道はどこだろう」と立ち止まる。その感覚は迷いではなく、魂が次の季節へ進む準備を始めた合図です。",
    ],
    analysisLead: "あなたの運勢全体を貫いているのは、「熟成から開花へ」という大きな流れです。",
    actions: [
      "朝、窓を開けて深呼吸をしてから一日を始める——運気の入口を物理的にひらく習慣です",
      "「いつかやりたいこと」をひとつ、手帳の最初のページに書き写す",
      "三ヶ月以上連絡していない大切な人に、短い便りを送る",
    ],
    closing: "焦る必要はありません。あなたの物語は、いま最も美しい章に差しかかろうとしています。",
  },
  love: {
    label: "恋愛運",
    empathy: [
      "人を想う気持ちは、ときに自分でも持て余すほどの重さになります。相手の言葉のひとつひとつに心が揺れ、進むべきか、待つべきか——その逡巡の夜を、あなたはいくつも越えてきたのではないでしょうか。その想いの深さこそ、まずあなた自身が認めてあげてください。",
      "誰かを大切に想うとき、人は強くなると同時に、とても繊細になります。いまのあなたの心の揺れは、それだけ真剣に向き合っている証です。",
    ],
    analysisLead: "あなたの恋愛運を流れているのは、「言葉にならなかった想いが、形を持ち始める」という潮目です。",
    actions: [
      "相手に伝えたいことを、送らない手紙として一度すべて書き出す——想いが整理され、本当に伝えるべき一文が残ります",
      "守護色のものをひとつ、身につけるか持ち歩く",
      "「相手がどう思うか」を考える時間を半分にして、「自分はどうしたいか」を考える時間にあてる",
    ],
    closing: "愛情は、急かさずに育てたものほど深く根を張ります。あなたの想いは、ちゃんと届く軌道の上にあります。",
  },
  work: {
    label: "仕事運",
    empathy: [
      "責任という重さを背負いながら、それでも「このままの働き方でいいのだろうか」と問い直す——その真摯さは、決して弱さではありません。日々の務めを果たしながら次の地平を探すあなたの姿勢を、星々は誠実さとして記録しています。",
      "頑張りが正しく報われているのか、ふと不安になる夜があるかもしれません。けれど、あなたが積み上げてきたものは、あなたが思うよりずっと確かな形になっています。",
    ],
    analysisLead: "あなたの仕事運の基調は、「水面下の積み上げが、評価という形で浮上する」転換期にあります。",
    actions: [
      "これまでの成果を三行で書き出し、見える場所に貼る——自己評価の軸を取り戻す儀式です",
      "尊敬する人に、近況報告を兼ねた連絡をひとつ入れる",
      "新しく学びたい分野の本を一冊、今週中に手に入れる",
    ],
    closing: "実りの季節は、種を蒔いた人にだけ訪れます。あなたはすでに、十分な種を蒔いてきました。",
  },
  money: {
    label: "金運",
    empathy: [
      "お金の話は、誰にも相談しづらいものです。堅実でありたい気持ちと、もっと豊かでありたい願いのあいだで揺れる——その揺れは恥ずかしいことではなく、未来を真剣に考えている人にだけ訪れる、健全な揺らぎです。",
      "豊かさへの願いは、欲深さではありません。それは「大切なものを守りたい」という愛情の、もうひとつの姿です。",
    ],
    analysisLead: "あなたの金運は、「流れを堰き止めていた小さな石が取り除かれる」局面に入っています。",
    actions: [
      "財布の中を整え、使っていないカードや古いレシートを取り除く——金運の通り道の掃除です",
      "「生き金」と感じた支出をひとつ、ためらわずに実行する",
      "収入の入口を増やすアイデアを三つ、誰にも見せないメモに書く",
    ],
    closing: "お金は、丁寧に扱う人のもとに長く留まります。あなたの誠実さは、豊かさの最も確かな土台です。",
  },
  human: {
    label: "対人運",
    empathy: [
      "人とのあいだで気を配りつづけることは、目に見えない長距離走のようなものです。笑顔の裏で少し疲れている自分に、あなたは気づいているはず。その疲れは、あなたが人を雑に扱えない優しさの証です。",
      "わかり合えたと思った人との距離に、ふと戸惑うことがあります。けれど人間関係の揺らぎは、関係が生きて動いている証拠でもあるのです。",
    ],
    analysisLead: "あなたの対人運は、「縁の棚卸し」とも呼ぶべき、結び直しの時期に入っています。",
    actions: [
      "「会うと元気になる人」を三人思い浮かべ、そのうち一人に連絡する",
      "気の進まない誘いをひとつ、丁寧に断ってみる——縁の風通しが良くなります",
      "ありがとうを、いつもより一言だけ具体的に伝える",
    ],
    closing: "すべての人と分かり合う必要はありません。あなたの灯を大切にしてくれる人は、確かに存在しています。",
  },
};

/* ============================================================
   鑑定ロジック
   ============================================================ */

function getZodiac(month, day) {
  for (const z of ZODIAC) {
    const [fm, fd] = z.from, [tm, td] = z.to;
    if (fm === 12) { // 山羊座（年跨ぎ）
      if ((month === 12 && day >= fd) || (month === 1 && day <= td)) return z;
    } else if ((month === fm && day >= fd) || (month === tm && day <= td)) {
      return z;
    }
  }
  return ZODIAC[0];
}

function getLifePath(y, m, d) {
  let digits = (String(y) + String(m) + String(d)).split("").map(Number);
  let sum = digits.reduce((a, b) => a + b, 0);
  while (sum > 9 && sum !== 11 && sum !== 22 && sum !== 33) {
    sum = String(sum).split("").map(Number).reduce((a, b) => a + b, 0);
  }
  return sum;
}

/* 鑑定結果オブジェクトの生成 */
function generateReading(input) {
  const { name, y, m, d, topic, concern, cards } = input;
  const seedFn = xmur3(name + y + "-" + m + "-" + d + topic);
  const rng = mulberry32(seedFn());
  const pick = (arr) => arr[Math.floor(rng() * arr.length)];

  const zodiac = getZodiac(m, d);
  const lifePath = getLifePath(y, m, d);
  const numerology = NUMEROLOGY[lifePath];
  const color = COLORS[Math.floor(rng() * COLORS.length)];
  const oracle = pick(ORACLES);
  const item = pick(ITEMS);
  const topicData = TOPICS[topic];

  /* 五運スコア（シード乱数 + カードの正逆で補正） */
  const upCount = cards.filter(c => !c.reversed).length;
  const base = 55 + upCount * 5;
  const scores = ["恋愛", "仕事", "金運", "健康", "対人"].map(label => ({
    label,
    value: Math.min(98, Math.max(42, Math.round(base + (rng() - 0.45) * 38))),
  }));
  /* 選択ジャンルのスコアを少し引き上げる（見せ場を作る） */
  const topicIndex = { love: 0, work: 1, money: 2, human: 4 }[topic];
  if (topicIndex !== undefined) {
    scores[topicIndex].value = Math.min(97, scores[topicIndex].value + 8);
  }

  /* 開運日（今日から7〜21日後の範囲で2日） */
  const today = new Date();
  const luckyDays = [7 + Math.floor(rng() * 7), 15 + Math.floor(rng() * 7)].map(offset => {
    const dt = new Date(today.getTime() + offset * 864e5);
    return `${dt.getMonth() + 1}月${dt.getDate()}日（${"日月火水木金土"[dt.getDay()]}）`;
  });

  /* --- 鑑定文の組み立て --- */
  const [past, present, future] = cards;
  const honorific = name + "さん";

  const empathy = pick(topicData.empathy)
    + (concern
        ? `「${concern}」——その問いを胸に、この頁をひらいたあなたへ。三つの理が示した答えを、これからお伝えします。`
        : `この鑑定書は、${honorific}という一人のための、世界にひとつの星図です。`);

  const analysis =
    `${topicData.analysisLead}` +
    `${zodiac.name}に生まれたあなたは、本質として「${zodiac.trait}」の気質——すなわち${zodiac.essence}を携えています。` +
    `そこに数秘${lifePath}「${numerology.name}」が重なります。${numerology.essence}`;

  const tarotText =
    `札が語るのは、より具体的な道筋です。過去の位置にひらかれた「${past.card.name}」${past.reversed ? "（逆位置）" : ""}は、こう告げています——${past.reversed ? past.card.revMsg : past.card.upMsg}` +
    `現在を示す「${present.card.name}」${present.reversed ? "（逆位置）" : ""}が伝えるのは——${present.reversed ? present.card.revMsg : present.card.upMsg}` +
    `そして未来の位置に現れた「${future.card.name}」${future.reversed ? "（逆位置）" : ""}。${future.reversed ? future.card.revMsg : future.card.upMsg}` +
    `三枚を貫いて読むなら、過去に蒔かれた種が現在の土の中で根を張り、未来でその芽が地上に顔を出す——そんな連続した物語が見えています。`;

  const guidance = numerology.advice;

  return {
    name, y, m, d, topic, concern,
    zodiac, lifePath, numerology, color, oracle, item,
    scores, luckyDays, cards,
    text: {
      empathy,
      analysis,
      tarotText,
      guidance,
      actions: topicData.actions,
      closing: topicData.closing,
    },
  };
}

/* ============================================================
   AI鑑定エンジン（Gemini）
   - 体験版：Cloudflare Worker（Proxy）経由でキーを隠して呼ぶ
   - 各自キー設定後：ブラウザから自分のキーで直接呼ぶ
   - どちらも無ければ：ローカル鑑定文にフォールバック（壊れない）
   ============================================================ */
const CFG = (typeof window !== "undefined" && window.HOSHIYOMI_CONFIG) || {};
const USER_KEY_STORE = "hoshiyomi-user-key";
function getUserKey() { try { return localStorage.getItem(USER_KEY_STORE) || ""; } catch (_) { return ""; } }

const READING_SCHEMA = {
  type: "object",
  properties: {
    empathy:   { type: "string" },
    analysis:  { type: "string" },
    tarotText: { type: "string" },
    guidance:  { type: "string" },
    closing:   { type: "string" },
    oracle:    { type: "string" },
  },
  required: ["empathy", "analysis", "tarotText", "guidance", "closing"],
};

function buildReadingPrompt(r) {
  const POS = ["過去", "現在", "未来"];
  const cardLines = r.cards.map((pc, i) =>
    `${POS[i]}：${pc.card.name}（${pc.reversed ? "逆位置" : "正位置"}）— 象徴：${(pc.reversed ? pc.card.rev : pc.card.up).join("・")}`
  ).join("\n");
  const topicLabel = (TOPICS[r.topic] && TOPICS[r.topic].label) || r.topic;
  return [
    "あなたは「星詠ノ書」という和風の占い鑑定書を綴る、格調高い占い師です。",
    "墨色の夜空とアンティークゴールドの世界観にふさわしい、あたたかく詩的で神秘的な日本語で鑑定文を書いてください。",
    "相談者は必ず「" + r.name + "さん」と名前で呼び、断定を避けて「流れ」「兆し」「可能性」として穏やかに伝えます。",
    "マークダウン記号や見出し記号は使わず、自然な文章のみ。各項目は3〜5文で、テンプレ感を避け、この人だけの言葉で綴ること。",
    "",
    "【相談者】" + r.name + "さん",
    "【生年月日】" + r.y + "年" + r.m + "月" + r.d + "日",
    "【占うテーマ】" + topicLabel,
    r.concern ? "【心にあること】" + r.concern : "【心にあること】特になし",
    "【星位】" + r.zodiac.name + "（" + r.zodiac.element + "のエレメント／守護星・" + r.zodiac.planet + "）本質：" + r.zodiac.trait,
    "【数秘】" + r.lifePath + "「" + r.numerology.name + "」" + r.numerology.essence,
    "【守護色】" + r.color.name,
    "【引かれた三枚の札】",
    cardLines,
    "",
    "次のJSON形式で、各キーに鑑定文（プレーンな日本語の文章）を入れて返してください：",
    "empathy＝相談者へのやさしい導入と共感／analysis＝星位と数秘から読むこの人の本質／tarotText＝三枚の札が示す過去・現在・未来のひと続きの物語／guidance＝明日への具体的であたたかい後押し／closing＝締めのことば／oracle＝今日の一文（15〜28字の詩的な箴言）",
  ].join("\n");
}

function parseReadingJSON(text) {
  if (!text) return null;
  let t = String(text).trim();
  const a = t.indexOf("{"), b = t.lastIndexOf("}");
  if (a >= 0 && b > a) t = t.slice(a, b + 1);
  try {
    const o = JSON.parse(t);
    if (o && (o.empathy || o.analysis || o.tarotText)) return o;
  } catch (_) {}
  return null;
}

async function callGeminiDirect(key, prompt) {
  const model = CFG.MODEL || "gemini-2.0-flash";
  const res = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/models/" + model + ":generateContent?key=" + encodeURIComponent(key),
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 1.05, maxOutputTokens: 1400,
          responseMimeType: "application/json", responseSchema: READING_SCHEMA,
        },
      }),
    }
  );
  if (!res.ok) throw new Error("gemini " + res.status);
  const data = await res.json();
  return (data && data.candidates && data.candidates[0] && data.candidates[0].content &&
    data.candidates[0].content.parts && data.candidates[0].content.parts[0] &&
    data.candidates[0].content.parts[0].text) || "";
}

const Engine = {
  /* 成功時は {empathy, analysis, ...} を返す。使えない時は null（ローカル文のまま） */
  async generateReadingText(r) {
    try {
      const prompt = buildReadingPrompt(r);
      const userKey = getUserKey();
      let raw = "";
      if (userKey) {
        raw = await callGeminiDirect(userKey, prompt);
      } else if (CFG.PROXY_URL) {
        const res = await fetch(CFG.PROXY_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt }),
        });
        if (!res.ok) throw new Error("proxy " + res.status);
        raw = (await res.json()).text || "";
      } else {
        return null;
      }
      return parseReadingJSON(raw);
    } catch (_) {
      return null;
    }
  },
};

/* ============================================================
   UI 制御
   ============================================================ */

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

/* 記号を絵文字ではなくテキスト字形で描画させる（U+FE0E） */
const tg = (glyph) => glyph + "\uFE0E";

/* \u843D\u6B3E\u5370\uFF08\u6731\u5370\uFF09SVG \u2014 \u672C\u7269\u306E\u9451\u5B9A\u66F8\u3089\u3057\u3055\u3092\u6F14\u51FA */
function sealSVG(px = 72) {
  return `
  <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" width="${px}" height="${px}">
    <defs>
      <filter id="seal-rough"><feTurbulence type="fractalNoise" baseFrequency="0.5" numOctaves="2" result="n"/>
        <feDisplacementMap in="SourceGraphic" in2="n" scale="1.6"/></filter>
    </defs>
    <g filter="url(#seal-rough)">
      <rect x="6" y="6" width="88" height="88" rx="9" fill="none" stroke="#b23a2e" stroke-width="4.5"/>
      <line x1="50" y1="12" x2="50" y2="88" stroke="#b23a2e" stroke-width="2"/>
      <line x1="12" y1="50" x2="88" y2="50" stroke="#b23a2e" stroke-width="2"/>
      <text x="31" y="33" fill="#b23a2e" font-size="29" font-weight="700" text-anchor="middle" dominant-baseline="central" font-family="'Shippori Mincho B1',serif">\u661F</text>
      <text x="69" y="33" fill="#b23a2e" font-size="29" font-weight="700" text-anchor="middle" dominant-baseline="central" font-family="'Shippori Mincho B1',serif">\u8A60</text>
      <text x="31" y="68" fill="#b23a2e" font-size="29" font-weight="700" text-anchor="middle" dominant-baseline="central" font-family="'Shippori Mincho B1',serif">\u4E4B</text>
      <text x="69" y="68" fill="#b23a2e" font-size="29" font-weight="700" text-anchor="middle" dominant-baseline="central" font-family="'Shippori Mincho B1',serif">\u5370</text>
    </g>
  </svg>`;
}

let state = {
  topic: "love",
  pickedCards: [],   // {card, reversed}
  result: null,
};

/* ---------- 星空キャンバス ---------- */
(function initStars() {
  const canvas = $("#stars");
  const ctx = canvas.getContext("2d");
  let stars = [];
  let w, h;

  function resize() {
    w = canvas.width = window.innerWidth;
    h = canvas.height = window.innerHeight;
    stars = Array.from({ length: Math.floor((w * h) / 9000) }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      r: Math.random() * 1.3 + 0.2,
      tw: Math.random() * Math.PI * 2,
      sp: 0.004 + Math.random() * 0.012,
      drift: 0.02 + Math.random() * 0.05,
    }));
  }

  function frame() {
    ctx.clearRect(0, 0, w, h);
    for (const s of stars) {
      s.tw += s.sp;
      s.y -= s.drift;
      if (s.y < -2) { s.y = h + 2; s.x = Math.random() * w; }
      const alpha = 0.25 + Math.abs(Math.sin(s.tw)) * 0.6;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fillStyle = s.r > 1.1
        ? `rgba(233,211,160,${alpha})`
        : `rgba(190,200,230,${alpha * 0.8})`;
      ctx.fill();
    }
    requestAnimationFrame(frame);
  }

  window.addEventListener("resize", resize);
  resize();
  frame();
})();

/* ---------- 画面遷移 ---------- */
function showScreen(id) {
  $$(".screen").forEach(s => s.classList.remove("active"));
  $(id).classList.add("active");
  window.scrollTo({ top: 0 });
}

/* ---------- 画面1: フォーム ---------- */
$("#topic-chips").addEventListener("click", (e) => {
  const chip = e.target.closest(".chip");
  if (!chip) return;
  $$("#topic-chips .chip").forEach(c => c.classList.remove("active"));
  chip.classList.add("active");
  state.topic = chip.dataset.topic;
});

$("#btn-start").addEventListener("click", () => {
  const name = $("#in-name").value.trim();
  const birth = $("#in-birth").value;
  if (!name || !birth) {
    alert("御名前と生年月日をお教えください。");
    return;
  }
  Sound.ensure();
  Sound.chime();
  startRitual();
});

/* ---------- 画面2: 鑑定中の儀 ---------- */
function buildRitualSVG() {
  const svg = $("#ritual-svg");
  const G = "#c9a86a";
  let ticks = "";
  for (let i = 0; i < 36; i++) {
    const a = (i / 36) * Math.PI * 2;
    const r1 = 128, r2 = i % 3 === 0 ? 118 : 123;
    ticks += `<line x1="${150 + Math.cos(a) * r1}" y1="${150 + Math.sin(a) * r1}" x2="${150 + Math.cos(a) * r2}" y2="${150 + Math.sin(a) * r2}" stroke="${G}" stroke-width="0.7" opacity="0.7"/>`;
  }
  let glyphs = "";
  ZODIAC.forEach((z, i) => {
    const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
    glyphs += `<text x="${150 + Math.cos(a) * 104}" y="${150 + Math.sin(a) * 104}" fill="${G}" font-size="13" text-anchor="middle" dominant-baseline="central" opacity="0.85">${tg(z.glyph)}</text>`;
  });
  svg.innerHTML = `
    <circle cx="150" cy="150" r="130" fill="none" stroke="${G}" stroke-width="0.8" opacity="0.8"/>
    <g class="ritual-ring slow"><g>${ticks}</g></g>
    <g class="ritual-ring rev">
      <circle cx="150" cy="150" r="92" fill="none" stroke="${G}" stroke-width="0.6" stroke-dasharray="3 6" opacity="0.7"/>
      ${glyphs}
    </g>
    <g class="ritual-ring">
      <polygon points="150,82 209,184 91,184" fill="none" stroke="${G}" stroke-width="0.7" opacity="0.65"/>
      <polygon points="150,218 91,116 209,116" fill="none" stroke="${G}" stroke-width="0.7" opacity="0.65"/>
    </g>
    <circle cx="150" cy="150" r="26" fill="none" stroke="${G}" stroke-width="0.8" opacity="0.9"/>
    <text x="150" y="150" fill="#e9d3a0" font-size="20" text-anchor="middle" dominant-baseline="central">✶</text>
  `;
}

const RITUAL_PHRASES = [
  "星の配置を読んでいます",
  "生年月日から数秘を演算しています",
  "御名に宿る音を聴いています",
  "三つの理を編み合わせています",
];

function startRitual() {
  buildRitualSVG();
  showScreen("#screen-ritual");
  let i = 0;
  $("#ritual-text").textContent = RITUAL_PHRASES[0];
  const timer = setInterval(() => {
    i++;
    if (i >= RITUAL_PHRASES.length) {
      clearInterval(timer);
      setupCardScreen();
      showScreen("#screen-cards");
      return;
    }
    $("#ritual-text").textContent = RITUAL_PHRASES[i];
  }, 1600);
}

/* ---------- 画面3: タロット ---------- */
const CARD_BACK_SVG = `
  <svg viewBox="0 0 60 90" xmlns="http://www.w3.org/2000/svg">
    <circle cx="30" cy="45" r="20" fill="none" stroke="#c9a86a" stroke-width="0.8"/>
    <circle cx="30" cy="45" r="13" fill="none" stroke="#c9a86a" stroke-width="0.5" stroke-dasharray="2 3"/>
    <path d="M30 27 L34 41 L48 45 L34 49 L30 63 L26 49 L12 45 L26 41 Z" fill="none" stroke="#e9d3a0" stroke-width="0.8"/>
    <circle cx="30" cy="45" r="2" fill="#e9d3a0"/>
  </svg>`;

function cardFaceHTML(pc, mini = false) {
  return `
    <div class="card-face ${pc.reversed ? "reversed-face" : ""}">
      <div class="face-frame"></div>
      <div class="face-corner tl"></div><div class="face-corner tr"></div>
      <div class="face-corner bl"></div><div class="face-corner br"></div>
      <div class="face-inner">
        <span class="face-num">${pc.card.num}</span>
        <span class="face-emblem">
          <svg viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <circle cx="30" cy="30" r="26" fill="none" stroke="#6e5a2e" stroke-width="0.6" opacity="0.5"/>
            ${Array.from({ length: 16 }, (_, i) => {
              const a = (i / 16) * Math.PI * 2, r1 = 26, r2 = i % 2 ? 22 : 19;
              return `<line x1="${30 + Math.cos(a) * r1}" y1="${30 + Math.sin(a) * r1}" x2="${30 + Math.cos(a) * r2}" y2="${30 + Math.sin(a) * r2}" stroke="#8a6a2c" stroke-width="0.6" opacity="0.55"/>`;
            }).join("")}
          </svg>
          <span class="face-glyph">${tg(pc.card.glyph)}</span>
        </span>
        <span class="face-name">${pc.card.name}</span>
      </div>
    </div>`;
}

function setupCardScreen() {
  state.pickedCards = [];
  $("#pick-left").textContent = "3";
  $("#btn-reveal").disabled = true;
  $$(".card-slot").forEach(s => { s.classList.remove("filled"); s.querySelector(".slot-card").innerHTML = ""; });

  const fan = $("#card-fan");
  fan.innerHTML = "";
  const shuffled = [...DECK].sort(() => Math.random() - 0.5);
  const N = Math.min(16, shuffled.length);
  for (let i = 0; i < N; i++) {
    const el = document.createElement("div");
    el.className = "fan-card";
    const angle = (i - (N - 1) / 2) * 3.2;
    el.style.transform = `rotate(${angle}deg)`;
    el.style.zIndex = i;
    el.style.animationDelay = `${i * 0.05}s`;
    el.innerHTML = `<div class="card-back">${CARD_BACK_SVG}</div>`;
    el.addEventListener("click", () => pickCard(el, shuffled[i]));
    fan.appendChild(el);
  }
}

function pickCard(el, card) {
  if (state.pickedCards.length >= 3 || el.classList.contains("picked")) return;
  el.classList.add("picked");
  Sound.chime();
  const reversed = Math.random() < 0.3;
  const pc = { card, reversed };
  state.pickedCards.push(pc);

  const slotIdx = state.pickedCards.length - 1;
  const slot = $$(".card-slot")[slotIdx];
  slot.classList.add("filled");
  slot.querySelector(".slot-card").innerHTML = `
    <div class="flip-scene">
      <div class="flip-inner">
        <div class="card-back">${CARD_BACK_SVG}</div>
        ${cardFaceHTML(pc)}
      </div>
    </div>`;

  const left = 3 - state.pickedCards.length;
  $("#pick-left").textContent = left;
  if (left === 0) {
    $("#cards-guide").innerHTML = "三枚の札が、あなたを選びました";
    $("#btn-reveal").disabled = false;
  }
}

$("#btn-reveal").addEventListener("click", () => {
  const inners = $$(".card-slot .flip-inner");
  inners.forEach((inner, i) => {
    setTimeout(() => { inner.classList.add("flipped"); Sound.flip(); }, i * 600);
  });
  $("#btn-reveal").disabled = true;

  /* 決定的な鑑定結果を先に計算（星位・数秘・スコア・ローカル鑑定文） */
  const [by, bm, bd] = $("#in-birth").value.split("-").map(Number);
  const result = generateReading({
    name: $("#in-name").value.trim(),
    y: by, m: bm, d: bd,
    topic: state.topic,
    concern: $("#in-concern").value.trim(),
    cards: state.pickedCards,
  });
  state.result = result;

  /* AI鑑定文を、カードめくり演出と並行して取得（失敗時はローカル文のまま） */
  const aiPromise = Engine.generateReadingText(result);

  setTimeout(async () => {
    const ai = await Promise.race([aiPromise, sleep(6000).then(() => null)]);
    if (ai) result.text = Object.assign({}, result.text, ai);
    buildResult(result);
    showScreen("#screen-result");
    Sound.reveal();
    Sound.ambientStart();
  }, 600 * 3 + 1400);
});

/* ---------- 画面4: 結果 ---------- */

function buildResult(result) {
  const name = result.name;
  state.result = result;

  /* ヘッダー */
  $("#r-name").textContent = name;
  const now = new Date();
  $("#r-date").textContent = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日 鑑定`;

  /* 三つの理 */
  drawZodiacWheel(result.zodiac);
  $("#r-sign").textContent = `${result.zodiac.name} ${tg(result.zodiac.glyph)}`;
  $("#r-sign-sub").textContent = `${result.zodiac.element}のエレメント ／ 守護星・${result.zodiac.planet}`;

  $("#r-number").textContent = result.lifePath;
  $("#r-number-name").textContent = result.numerology.name;
  $("#r-number-sub").textContent = result.numerology.sub;

  const orb = $("#r-orb");
  orb.style.background = `radial-gradient(circle at 36% 32%, ${result.color.hex}ee, ${result.color.hex}88 55%, ${result.color.hex}33)`;
  orb.style.boxShadow = `0 0 50px ${result.color.hex}66, inset 0 0 24px rgba(255,255,255,.18)`;
  $("#r-color-name").textContent = `${result.color.name}（${result.color.read}）`;
  $("#r-color-sub").textContent = result.color.sub;

  /* チャート */
  drawRadar(result.scores);
  const scoreList = $("#score-list");
  scoreList.innerHTML = result.scores.map(s => `
    <div class="score-item">
      <span class="score-label">${s.label}</span>
      <span class="score-bar"><i data-w="${s.value}"></i></span>
      <span class="score-num">${s.value}</span>
    </div>`).join("");

  /* タロット振り返り */
  const POS = ["過去", "現在", "未来"];
  $("#tarot-recap").innerHTML = result.cards.map((pc, i) => `
    <div class="recap-card">
      <p class="recap-pos">${POS[i]}</p>
      <div class="recap-mini">${cardFaceHTML(pc, true)}</div>
      <p class="recap-name">${pc.card.name}</p>
      <p class="recap-ori ${pc.reversed ? "rev" : ""}">${pc.reversed ? "逆位置" : "正位置"} — ${pc.card.en}</p>
      <p class="recap-words">${(pc.reversed ? pc.card.rev : pc.card.up).join("・")}</p>
    </div>`).join("");

  /* 鑑定文 */
  buildReadingHTML(result);

  /* 今日の一文 */
  $("#r-oracle").textContent = result.oracle;

  /* 落款印 */
  $("#result-seal").innerHTML = sealSVG(76);

  /* 印刷用鑑定書 */
  buildKanteisho(result);

  /* リビール演出 */
  requestAnimationFrame(() => {
    setTimeout(() => initReveals(), 80);
  });
}

/* --- 鑑定文タイプライター --- */
const sleep = (ms) => new Promise(res => setTimeout(res, ms));
let twState = { skip: false, running: false };

function prepareTypewriter() {
  const reading = $("#reading");
  twState = { skip: false, running: false };
  reading.querySelectorAll("[data-type]").forEach(p => {
    p.dataset.full = p.textContent;
    p.textContent = "";
  });
  reading.querySelectorAll("h3, ul, .lucky-row").forEach(el => el.classList.add("tw-wait"));
  reading.onclick = () => { twState.skip = true; };
}

async function runTypewriter() {
  if (twState.running) return;
  twState.running = true;
  const reading = $("#reading");
  for (const el of [...reading.children]) {
    if (twState.skip) break;
    if (el.hasAttribute("data-type")) {
      el.classList.add("typing-caret");
      const full = el.dataset.full || "";
      for (let i = 0; i < full.length && !twState.skip; i += 2) {
        el.textContent = full.slice(0, i + 2);
        await sleep(26);
      }
      el.textContent = full;
      el.classList.remove("typing-caret");
      await sleep(240);
    } else {
      el.classList.remove("tw-wait");
      await sleep(380);
    }
  }
  /* スキップ時・完了時の最終化 */
  reading.querySelectorAll("[data-type]").forEach(p => {
    p.textContent = p.dataset.full;
    p.classList.remove("typing-caret");
  });
  reading.querySelectorAll(".tw-wait").forEach(el => el.classList.remove("tw-wait"));
  twState.running = false;
}

function buildReadingHTML(r) {
  const t = r.text;
  $("#reading").innerHTML = `
    <h3>序 — あなたへ</h3>
    <p data-type>${t.empathy}</p>
    <h3>解 — 三つの理が示すこと</h3>
    <p data-type>${t.analysis}</p>
    <p data-type>${t.tarotText}</p>
    <h3>導 — 明日への一歩</h3>
    <p data-type>${t.guidance}　そのうえで、星が薦める具体的な振る舞いは次の三つです。</p>
    <ul>${t.actions.map(a => `<li>${a}</li>`).join("")}</ul>
    <p data-type>${t.closing}</p>
    <div class="lucky-row">
      <span>開運日<b>${r.luckyDays.join("、")}</b></span>
      <span>守護色<b>${r.color.name}</b></span>
      <span>縁起物<b>${r.item}</b></span>
    </div>`;
  prepareTypewriter();
}

/* スクロール連動リビール + スコアバー */
function initReveals() {
  const obs = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add("shown");
        e.target.querySelectorAll(".score-bar i").forEach(bar => {
          bar.style.width = bar.dataset.w + "%";
        });
        if (e.target.classList.contains("reading-section")) runTypewriter();
        obs.unobserve(e.target);
      }
    });
  }, { threshold: 0.12 });
  $$(".reveal").forEach(el => { el.classList.remove("shown"); obs.observe(el); });
}

/* --- SVG: 星座ホイール --- */
function drawZodiacWheel(active) {
  const svg = $("#zodiac-wheel");
  const C = 130, R = 118;
  const G = "#c9a86a";
  let seg = "";
  ZODIAC.forEach((z, i) => {
    const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
    const isActive = z.name === active.name;
    seg += `<text x="${C + Math.cos(a) * 96}" y="${C + Math.sin(a) * 96}"
      fill="${isActive ? "#e9d3a0" : "rgba(201,168,106,.45)"}"
      font-size="${isActive ? 18 : 12}" text-anchor="middle" dominant-baseline="central">${tg(z.glyph)}</text>`;
    if (isActive) {
      seg += `<circle cx="${C + Math.cos(a) * 96}" cy="${C + Math.sin(a) * 96}" r="16" fill="none" stroke="#e9d3a0" stroke-width="0.8" opacity="0.9"/>`;
      seg += `<line x1="${C}" y1="${C}" x2="${C + Math.cos(a) * 78}" y2="${C + Math.sin(a) * 78}" stroke="${G}" stroke-width="0.6" opacity="0.7"/>`;
    }
    const la = a + Math.PI / 12;
    seg += `<line x1="${C + Math.cos(la) * (R - 8)}" y1="${C + Math.sin(la) * (R - 8)}" x2="${C + Math.cos(la) * R}" y2="${C + Math.sin(la) * R}" stroke="${G}" stroke-width="0.5" opacity="0.5"/>`;
  });
  svg.innerHTML = `
    <circle cx="${C}" cy="${C}" r="${R}" fill="none" stroke="${G}" stroke-width="0.8" opacity="0.7"/>
    <circle cx="${C}" cy="${C}" r="${R - 36}" fill="none" stroke="${G}" stroke-width="0.5" opacity="0.4"/>
    <circle cx="${C}" cy="${C}" r="3" fill="${G}"/>
    ${seg}`;
}

/* --- SVG: レーダーチャート --- */
function drawRadar(scores) {
  const svg = $("#radar");
  const CX = 160, CY = 155, R = 105;
  const N = scores.length;
  const pt = (i, ratio) => {
    const a = (i / N) * Math.PI * 2 - Math.PI / 2;
    return [CX + Math.cos(a) * R * ratio, CY + Math.sin(a) * R * ratio];
  };

  let grid = "";
  for (let ring = 1; ring <= 4; ring++) {
    const pts = Array.from({ length: N }, (_, i) => pt(i, ring / 4).join(",")).join(" ");
    grid += `<polygon points="${pts}" fill="none" stroke="rgba(201,168,106,.22)" stroke-width="0.7"/>`;
  }
  let axes = "", labels = "";
  scores.forEach((s, i) => {
    const [x, y] = pt(i, 1);
    axes += `<line x1="${CX}" y1="${CY}" x2="${x}" y2="${y}" stroke="rgba(201,168,106,.25)" stroke-width="0.6"/>`;
    const [lx, ly] = pt(i, 1.2);
    labels += `<text x="${lx}" y="${ly}" fill="#aab4d4" font-size="13" letter-spacing="2" text-anchor="middle" dominant-baseline="central" font-family="'Shippori Mincho B1',serif">${s.label}</text>`;
  });

  const valuePts = scores.map((s, i) => pt(i, s.value / 100).join(",")).join(" ");
  const dots = scores.map((s, i) => {
    const [x, y] = pt(i, s.value / 100);
    return `<circle cx="${x}" cy="${y}" r="3" fill="#e9d3a0"/>`;
  }).join("");

  svg.innerHTML = `
    ${grid}${axes}
    <polygon points="${valuePts}" fill="rgba(201,168,106,.16)" stroke="#c9a86a" stroke-width="1.4"/>
    ${dots}${labels}`;
}

/* ============================================================
   印刷用 鑑定書（PDF）
   ============================================================ */
function buildKanteisho(r) {
  const POS = ["過去", "現在", "未来"];
  const now = new Date();
  const t = r.text;

  const emblem = `
    <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <circle cx="50" cy="50" r="44" fill="none" stroke="#a8843c" stroke-width="0.8"/>
      <circle cx="50" cy="50" r="34" fill="none" stroke="#a8843c" stroke-width="0.5" stroke-dasharray="2 3"/>
      <path d="M50 18 L57 43 L82 50 L57 57 L50 82 L43 57 L18 50 L43 43 Z" fill="none" stroke="#8a6a2c" stroke-width="0.9"/>
      <circle cx="50" cy="50" r="3" fill="#a8843c"/>
    </svg>`;

  $("#kanteisho").innerHTML = `
    <!-- 表紙 -->
    <div class="k-page k-cover">
      <div class="k-frame"></div>
      <p class="k-cover-kicker">HOSHIYOMI — AI FORTUNE ATELIER</p>
      <h1 class="k-cover-title">鑑　定　書</h1>
      <div class="k-cover-emblem">${emblem}</div>
      <p class="k-cover-name">${r.name} 様</p>
      <p class="k-cover-date">${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日 謹製 ／ ${TOPICS[r.topic].label}の鑑定</p>
      <div class="k-cover-seal">${sealSVG(64)}</div>
      <p class="k-cover-issuer">星詠ノ書</p>
    </div>

    <!-- 本文1: 三つの理とチャート -->
    <div class="k-page">
      <div class="k-frame"></div>
      <div class="k-section">
        <h2 class="k-h2">三つの理</h2>
        <div class="k-grid3">
          <div class="k-cell">
            <p class="k-cell-label">星位</p>
            <p class="k-cell-value">${r.zodiac.name} ${tg(r.zodiac.glyph)}</p>
            <p class="k-cell-sub">${r.zodiac.element}のエレメント<br>守護星・${r.zodiac.planet}</p>
          </div>
          <div class="k-cell">
            <p class="k-cell-label">数秘</p>
            <p class="k-bignum">${r.lifePath}</p>
            <p class="k-cell-value" style="font-size:11pt">${r.numerology.name}</p>
            <p class="k-cell-sub">${r.numerology.sub}</p>
          </div>
          <div class="k-cell">
            <p class="k-cell-label">守護色</p>
            <div class="k-orb-print" style="background:${r.color.hex}"></div>
            <p class="k-cell-value" style="font-size:11pt">${r.color.name}</p>
            <p class="k-cell-sub">${r.color.sub}</p>
          </div>
        </div>
      </div>

      <div class="k-section">
        <h2 class="k-h2">三枚の札</h2>
        <div class="k-tarot-row">
          ${r.cards.map((pc, i) => `
            <div class="k-tarot">
              <p class="k-tarot-pos">${POS[i]}</p>
              <p class="k-tarot-name">${pc.card.name}</p>
              <p class="k-tarot-ori">${pc.reversed ? "逆位置" : "正位置"} — ${pc.card.en}</p>
              <p class="k-tarot-words">${(pc.reversed ? pc.card.rev : pc.card.up).join("・")}</p>
            </div>`).join("")}
        </div>
      </div>

      <div class="k-section">
        <h2 class="k-h2">五運の均衡</h2>
        <table class="k-scores">
          ${r.scores.map(s => `
            <tr>
              <td class="sc-label">${s.label}</td>
              <td class="sc-bar-cell"><div class="sc-bar"><i style="width:${s.value}%"></i></div></td>
              <td class="sc-num">${s.value}</td>
            </tr>`).join("")}
        </table>
      </div>
      <p class="k-footer">HOSHIYOMI — PAGE 1</p>
    </div>

    <!-- 本文2: 鑑定文 -->
    <div class="k-page">
      <div class="k-frame"></div>
      <div class="k-reading">
        <h2 class="k-h2">鑑　定</h2>
        <h3>序 — あなたへ</h3>
        <p>${t.empathy}</p>
        <h3>解 — 三つの理が示すこと</h3>
        <p>${t.analysis}</p>
        <p>${t.tarotText}</p>
        <h3>導 — 明日への一歩</h3>
        <p>${t.guidance}</p>
        <ul>${t.actions.map(a => `<li>${a}</li>`).join("")}</ul>
        <p>${t.closing}</p>
        <div class="k-lucky">
          開運日<b>${r.luckyDays.join("、")}</b>
          守護色<b>${r.color.name}</b>
          縁起物<b>${r.item}</b>
        </div>
        <p class="k-oracle">“ ${r.oracle} ”</p>
        <div class="k-reading-seal">${sealSVG(58)}</div>
      </div>
      <p class="k-footer">HOSHIYOMI — PAGE 2</p>
    </div>`;
}

$("#btn-pdf").addEventListener("click", () => window.print());

/* ============================================================
   シェア用画像（Canvas）
   ============================================================ */
$("#btn-share").addEventListener("click", async () => {
  const r = state.result;
  if (!r) return;
  await document.fonts.ready;

  const W = 1080, H = 1350;
  const cv = document.createElement("canvas");
  cv.width = W; cv.height = H;
  const ctx = cv.getContext("2d");

  /* 背景 */
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#0a0d18");
  bg.addColorStop(1, "#11152a");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  /* 星 */
  for (let i = 0; i < 140; i++) {
    const x = Math.random() * W, y = Math.random() * H;
    const rr = Math.random() * 1.8 + 0.4;
    ctx.beginPath();
    ctx.arc(x, y, rr, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${Math.random() > 0.7 ? "233,211,160" : "180,190,220"},${0.2 + Math.random() * 0.5})`;
    ctx.fill();
  }

  /* 金枠 */
  ctx.strokeStyle = "#c9a86a";
  ctx.lineWidth = 2;
  ctx.strokeRect(46, 46, W - 92, H - 92);
  ctx.lineWidth = 0.8;
  ctx.strokeRect(58, 58, W - 116, H - 116);

  const center = W / 2;
  ctx.textAlign = "center";

  ctx.fillStyle = "#8a7448";
  ctx.font = "26px Cinzel, serif";
  ctx.fillText("H O S H I Y O M I", center, 150);

  ctx.fillStyle = "#e9d3a0";
  ctx.font = "700 92px 'Shippori Mincho B1', serif";
  ctx.fillText("鑑 定 書", center, 280);

  ctx.fillStyle = "#d8dcea";
  ctx.font = "44px 'Shippori Mincho B1', serif";
  ctx.fillText(`${r.name} 様`, center, 390);

  /* 星座・数秘・色 */
  ctx.fillStyle = "#c9a86a";
  ctx.font = "30px 'Shippori Mincho B1', serif";
  ctx.fillText(`${r.zodiac.name} ${tg(r.zodiac.glyph)}　×　数秘 ${r.lifePath}「${r.numerology.name}」`, center, 500);

  /* 守護色オーブ */
  const orbY = 640;
  const grad = ctx.createRadialGradient(center - 16, orbY - 16, 6, center, orbY, 64);
  grad.addColorStop(0, r.color.hex + "ff");
  grad.addColorStop(1, r.color.hex + "44");
  ctx.beginPath();
  ctx.arc(center, orbY, 60, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.strokeStyle = "#c9a86a";
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = "#aab4d4";
  ctx.font = "30px 'Shippori Mincho B1', serif";
  ctx.fillText(`守護色 — ${r.color.name}`, center, 760);

  /* カード */
  ctx.fillStyle = "#c9a86a";
  ctx.font = "26px 'Shippori Mincho B1', serif";
  const cardLine = r.cards.map((pc, i) => `${["過去", "現在", "未来"][i]}・${pc.card.name}${pc.reversed ? "(逆)" : ""}`).join("　");
  ctx.fillText(cardLine, center, 850);

  /* 一文 */
  ctx.fillStyle = "#d8dcea";
  ctx.font = "34px 'Shippori Mincho B1', serif";
  wrapText(ctx, `“ ${r.oracle} ”`, center, 990, W - 240, 58);

  ctx.fillStyle = "#8a7448";
  ctx.font = "22px Cinzel, serif";
  ctx.fillText("AI FORTUNE ATELIER", center, H - 110);

  /* ダウンロード */
  const a = document.createElement("a");
  a.download = `hoshiyomi_${r.name}.png`;
  a.href = cv.toDataURL("image/png");
  a.click();
});

function wrapText(ctx, text, x, y, maxW, lineH) {
  const chars = text.split("");
  let line = "", yy = y;
  for (const ch of chars) {
    if (ctx.measureText(line + ch).width > maxW) {
      ctx.fillText(line, x, yy);
      line = ch;
      yy += lineH;
    } else {
      line += ch;
    }
  }
  ctx.fillText(line, x, yy);
}

/* ============================================================
   音響演出（WebAudio・外部ファイル不要）
   ============================================================ */
const Sound = (() => {
  let ctx = null, master = null, ambientNodes = null;
  let muted = localStorage.getItem("hoshiyomi-muted") === "1";

  function ensure() {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(ctx.destination);
    }
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }

  /* 単音（柔らかい鐘） */
  function tone(freq, { dur = 1.6, type = "sine", gain = 0.12, delay = 0, attack = 0.02 } = {}) {
    if (!ctx) return;
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(gain, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g); g.connect(master);
    osc.start(t0); osc.stop(t0 + dur + 0.05);
  }

  /* 和音きらめき（ペンタトニック） */
  const PENTA = [523.25, 587.33, 698.46, 783.99, 880.0, 1046.5];

  function chime() {
    ensure();
    const n = PENTA[Math.floor(Math.random() * 4)];
    tone(n, { dur: 1.4, gain: 0.1, type: "triangle" });
    tone(n * 2, { dur: 1.0, gain: 0.04, type: "sine", delay: 0.02 });
  }

  function flip() {
    ensure();
    tone(330, { dur: 0.25, gain: 0.05, type: "sine", attack: 0.005 });
    tone(660, { dur: 0.5, gain: 0.06, type: "triangle", delay: 0.04 });
  }

  /* 結果表示の荘厳な広がり */
  function reveal() {
    ensure();
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) =>
      tone(f, { dur: 3.2, gain: 0.09, type: "sine", delay: i * 0.16, attack: 0.3 }));
    tone(130.81, { dur: 3.5, gain: 0.06, type: "sine", attack: 0.4 });
  }

  /* アンビエント・パッド（結果画面で常時、ごく微か） */
  function ambientStart() {
    ensure();
    if (ambientNodes) return;
    const g = ctx.createGain();
    g.gain.value = 0;
    g.gain.linearRampToValueAtTime(0.03, ctx.currentTime + 4);
    g.connect(master);
    const freqs = [130.81, 196.0, 261.63];
    const oscs = freqs.map((f, i) => {
      const o = ctx.createOscillator();
      o.type = "sine"; o.frequency.value = f;
      const lfo = ctx.createOscillator();
      const lfoG = ctx.createGain();
      lfo.frequency.value = 0.05 + i * 0.03; lfoG.gain.value = 1.5;
      lfo.connect(lfoG); lfoG.connect(o.frequency);
      o.connect(g); o.start(); lfo.start();
      return [o, lfo];
    });
    ambientNodes = { g, oscs };
  }
  function ambientStop() {
    if (!ambientNodes) return;
    const { g, oscs } = ambientNodes;
    g.gain.linearRampToValueAtTime(0, ctx.currentTime + 1.5);
    oscs.flat().forEach(o => o.stop(ctx.currentTime + 1.6));
    ambientNodes = null;
  }

  function setMuted(m) {
    muted = m;
    localStorage.setItem("hoshiyomi-muted", m ? "1" : "0");
    if (master) master.gain.linearRampToValueAtTime(m ? 0 : 0.5, (ctx?.currentTime || 0) + 0.2);
  }
  function isMuted() { return muted; }

  return { ensure, chime, flip, reveal, ambientStart, ambientStop, setMuted, isMuted };
})();

/* 音トグル */
(function initSoundToggle() {
  const btn = $("#sound-toggle");
  if (Sound.isMuted()) btn.classList.add("muted");
  btn.addEventListener("click", () => {
    const next = !Sound.isMuted();
    Sound.setMuted(next);
    btn.classList.toggle("muted", next);
    if (!next) Sound.ensure();
  });
})();

/* ---------- もう一度 ---------- */
$("#btn-again").addEventListener("click", () => {
  state.pickedCards = [];
  Sound.ambientStop();
  showScreen("#screen-intro");
});

/* ============================================================
   体験期間ゲート（手動切り替え）
   - config.js の EXPIRED を true にすると、自前APIキー未設定の人は
     expired.html（APIの設定案内）へ誘導される。
   - 自前キーを設定済みの人は、EXPIRED でも通常どおり利用できる。
   - URL ?expired=強制プレビュー ／ ?reset=自前キーを消去（検証用）
   ============================================================ */
(function initGate() {
  const p = new URLSearchParams(location.search);
  if (p.has("reset")) { try { localStorage.removeItem(USER_KEY_STORE); } catch (_) {} }

  const expired = (CFG.EXPIRED === true) || p.has("expired");
  const hasKey = !!getUserKey();

  if (expired && !hasKey) {
    location.replace("expired.html");
    return;
  }

  /* バッジ表示（自前キー利用中は非表示、それ以外は「体験版」） */
  const badge = $("#trial-badge");
  if (badge) badge.textContent = hasKey ? "" : "体験版";
})();
