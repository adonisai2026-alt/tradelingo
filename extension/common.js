// 共享配置：content script、background、设置页共用
var WADL_DEFAULTS = {
  apiKey: '',                    // DeepL API Key
  deepseekKey: '',               // DeepSeek API Key
  deepseekModel: 'deepseek-flash',
  qwenKey: '',                   // 阿里云百炼 API Key（Qwen-MT）
  qwenModel: 'qwen-mt-flash',
  qwenRegion: 'beijing',         // beijing / intl（Key 与地域绑定）
  enabled: true,                 // 总开关
  autoIncoming: true,            // 自动翻译收到的消息
  translateOwn: false,           // 同时翻译自己发出的消息
  incomingEngine: 'deepl',       // 收到的消息用哪个引擎：deepl / qwen / deepseek
  outgoingEngine: 'qwen',        // 发送时用哪个引擎
  incomingTarget: 'ZH-HANS',     // 收到的消息译成
  outgoingTarget: 'EN-US',       // 发送时译成
  formality: 'default',          // 发送语气：default / prefer_more（正式）/ prefer_less（随意）
  useContext: true,              // AI 翻译发送内容时参考最近聊天
  glossary: '',                  // 自定义术语表（AI 使用）
  autoChatLang: true,            // 按聊天自动识别客户语言
  backTranslate: true,           // 发送前显示回译（中文）
  // 快捷话术：每行 “关键词 | 中文内容”，在输入框输入 / 调出
  phrases: [
    '问候 | 您好！感谢您的咨询，请问有什么可以帮您？',
    '需求 | 请提供您需要的产品型号、规格参数（电流、电压、极数）和数量，我们会尽快为您报价。',
    '报价 | 这是我们的报价单，请查收。报价有效期为 7 天。',
    '交期 | 常规型号有现货，3–5 天可以发货；定制产品交期约 15–20 天。',
    '付款 | 我们接受 T/T 付款：30% 预付款，余款 70% 在发货前付清。',
    '样品 | 我们可以提供样品供您测试，样品费在您下单后可以退还。',
    '认证 | 我们的产品有 CE 和 CB 认证，可以提供证书。',
    '目录 | 这是我们最新的产品目录，请查看。如有感兴趣的型号请告诉我。',
    '跟进 | 您好，想跟进一下之前的报价，请问有什么问题或需要调整的地方吗？',
    '感谢 | 感谢您的订单！我们会尽快安排生产，并及时向您更新进度。'
  ].join('\n')
};

// DeepSeek 当前模型（见 api-docs.deepseek.com）；旧名 deepseek-chat / deepseek-reasoner 自动迁移到 deepseek-flash
var WADL_DS_MODELS = [
  ['deepseek-flash', 'deepseek-flash（快、便宜，推荐）'],
  ['deepseek-v4-pro', 'deepseek-v4-pro（更强、更贵）']
];
function wadlDsModel(m) {
  m = (m || '').trim();
  return !m || m === 'deepseek-chat' || m === 'deepseek-reasoner' ? 'deepseek-flash' : m;
}

var WADL_QWEN_MODELS = [
  ['qwen-mt-flash', 'qwen-mt-flash（快、便宜，推荐）'],
  ['qwen-mt-plus', 'qwen-mt-plus（质量最高）'],
  ['qwen-mt-lite', 'qwen-mt-lite（最快，语种较少）']
];
function wadlQwenModel(m) { return (m || '').trim() || 'qwen-mt-flash'; }

var WADL_ENGINES = { deepl: 'DeepL', qwen: 'Qwen-MT', deepseek: 'DeepSeek' };
var WADL_ENGINE_TAGS = { deepl: 'DeepL', qwen: 'Qwen', deepseek: 'DS' };
var WADL_KEY_FIELDS = { deepl: 'apiKey', qwen: 'qwenKey', deepseek: 'deepseekKey' };

// [代码, 中文名, 英文名（给 AI 用）, DeepL 是否支持]
var WADL_LANGS = [
  ['ZH-HANS', '简体中文', 'Simplified Chinese', true],
  ['ZH-HANT', '繁体中文', 'Traditional Chinese', true],
  ['EN-US', '英语（美式）', 'American English', true],
  ['EN-GB', '英语（英式）', 'British English', true],
  ['AR', '阿拉伯语', 'Arabic', true],
  ['RU', '俄语', 'Russian', true],
  ['ES', '西班牙语', 'Spanish', true],
  ['PT-BR', '葡萄牙语（巴西）', 'Brazilian Portuguese', true],
  ['PT-PT', '葡萄牙语（葡萄牙）', 'European Portuguese', true],
  ['FR', '法语', 'French', true],
  ['DE', '德语', 'German', true],
  ['IT', '意大利语', 'Italian', true],
  ['TR', '土耳其语', 'Turkish', true],
  ['ID', '印尼语', 'Indonesian', true],
  ['UK', '乌克兰语', 'Ukrainian', true],
  ['PL', '波兰语', 'Polish', true],
  ['NL', '荷兰语', 'Dutch', true],
  ['JA', '日语', 'Japanese', true],
  ['KO', '韩语', 'Korean', true],
  // 以下语言仅 AI 翻译（选 DeepL 时自动改用 Qwen-MT / DeepSeek）
  ['BN', '孟加拉语', 'Bengali', false],
  ['KK', '哈萨克语', 'Kazakh', false],
  ['UZ', '乌兹别克语', 'Uzbek', false],
  ['HI', '印地语', 'Hindi', false],
  ['UR', '乌尔都语', 'Urdu', false],
  ['FA', '波斯语', 'Persian', false],
  ['VI', '越南语', 'Vietnamese', false],
  ['TH', '泰语', 'Thai', false],
  ['MS', '马来语', 'Malay', false],
  ['FIL', '菲律宾语', 'Filipino (Tagalog)', false]
];
