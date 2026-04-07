#!/usr/bin/env python3
# One-off: build index_en.html from index.html (does not modify index.html)
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parent
src = (ROOT / "index.html").read_text(encoding="utf-8")

# Episode labels in data
src = re.sub(r"label: '(\d+)화'", r"label: 'Ep.\1'", src)
src = re.sub(r"ep: '(\d+)–(\d+)화'", r"ep: 'Eps.\1–\2'", src)

QUOTE_PAIRS = [
    ("첫 화를 봤는데 진짜 강렬했다. 예상을 못 했던 거라. 관심 없는 상태에서 관심 있는 상태로 바뀌었다.",
     "The first episode hit really hard — totally unexpected. I went from not caring to caring."),
    ("2화는 내가 생각했던 방향이 아니었다. 갑자기 고등학생들로 바뀌고, 그냥 너무 예측이 된다는 느낌이다.",
     "Ep.2 wasn\\'t the direction I expected — suddenly it\\'s high schoolers, and it feels too predictable."),
    ("그냥 예측 가능한 드라마라고 말할 수밖에 없다.",
     "I can only call it a predictable drama."),
    ("어디까지 가는지 보고 싶다. 결국 뭔가 있을 건지 궁금하다.",
     "I want to see how far it goes — curious if something\\'s actually coming."),
    ("또 예측 가능하다. 결국 여주는 남주랑 이어질 것 같고, 거기까지 볼 것 같지는 않다.",
     "Predictable again — she\\'ll probably end up with him, and I don\\'t think I\\'ll watch that far."),
    ("-3 가겠다. 더 재미있는 게 분명히 있을 것 같다.",
     "Going -3 — there\\'s definitely something more fun out there."),
    ("전체 인상은 -3으로 내려갔다. 그만두기로 했던 타이밍이 맞았다고 생각한다.",
     "Overall dropped to -3 — I think stopping when I did was the right call."),
    ("주인공이 계속 충분히 피할 수 있는 문제들에 빠진다. 등장인물들의 반응도 자연스러운 반응과 너무 거리가 멀다.",
     "The lead keeps walking into problems she could easily avoid — reactions feel far from natural."),
    ("10년이 지났어도 아무것도 달라진 게 없다. 여전히 그 남자한테 괴롭힘을 당하고 있다.",
     "Ten years later nothing\\'s changed — she\\'s still being harassed by the same guy."),
    ("결국 뭔가 있을지 궁금해서 보게 되는 것. 그게 전부다. 조금 관심이 있긴 하지만 계속 볼 이유로는 부족하다.",
     "I\\'m watching because I wonder if anything will happen — that\\'s it. Mild interest, not enough to keep going."),
    ("처음에 +3이었다. 결국 Twilight이랑 거의 똑같다는 게 보였다. -1 정도인 것 같다.",
     "Started at +3 — then it looked almost exactly like Twilight. More like -1."),
    ("0에서 1로 바뀐 유일한 순간은 그냥 또 sex sells 방식이었다. 키스를 했으니까 어디로 가는지 보자 하는 정도.",
     "The only 0→1 bump was sex sells again — they kissed, so I\\'d see where it goes, barely."),
    ("진짜 Twilight 그대로 가버렸다. 이 드라마는 오리지널이 될 가능성이 없다. 100% 예측 가능하다.",
     "It went full Twilight — this show has zero shot at feeling original. 100% predictable."),
    ("AI가 만든 것 같다는 거다. 단어는 있는데 연기가 없고, 그냥 자연스럽지가 않다.",
     "Feels AI-made — words are there but no acting, nothing natural."),
    ("또 Twilight이다. 뱀파이어라는 게 밝혀졌는데, 피 흘리는 장면이 싫어서 바로 흥미가 떨어졌다.",
     "Twilight again — vampire reveal, then a blood scene I hated and interest crashed."),
    ("6화까지 왔는데 진짜 힘들었다. 오리지널을 보고 싶다. 예측 가능성 때문에 관심이 떨어진다.",
     "Six episodes in was rough — I want something original. Predictability killed it."),
    ("처음부터 +1로 시작했다. 마법, 유적, 싸움 같은 액션이 나올 것 같은 장르를 좋아하는데 이게 그런 것 같다.",
     "Started +1 — I like magic, ruins, fights; this seemed like that kind of genre."),
    ("이 작품은 좀 더 오리지널한 것 같아서 좋다. OP가 될 것 같다.",
     "Feels more original — I like it. Feels like an OP protagonist arc."),
    ("아직 집중하고 있다. 성장 과정을 계속 보고 싶은데, 지나치게 강해질 것 같다는 느낌이 들기 시작한다.",
     "Still locked in — want the growth, but starting to feel he\\'ll get overpowered too fast."),
    ("다시 중립으로 돌아왔다. 4화에서 내 관심을 끈 게 없었다. 0을 주겠다.",
     "Back to neutral — Ep.4 didn\\'t hook me. Giving it 0."),
    ("0이다. 아무 데도 안 갔다. 흥미로운 게 없었다.",
     "Zero — went nowhere. Nothing interesting."),
    ("전개는 되고 있다. 레벨업 과정을 보여주지 않고 건너뛰는데 이미 레벨 30이다. 액션이나 싸움 장면도 없다.",
     "Plot moves but skips the level-up — already level 30 with no action or fights shown."),
    ("코미디 요소를 녹여내려 했다는 게 마음에 들었다. 다양한 직업이 나오는 게 흥미로웠다.",
     "Liked the comedy angle — different jobs showing up was interesting."),
    ("좋은 드라마로 발전할 가능성이 있는 것 같다. 잠재력이 있다고 생각한다.",
     "Could grow into a good drama — I see potential."),
    ("이모가 공중에서 아이를 데리고 나타나는 장면이 좋았다. 전체적으로는 +1.",
     "The aunt floating in with the kid — good scene. Overall +1."),
    ("속도가 붙기 시작했다. 지금까지 본 세 작품 중에서 가장 좋다.",
     "Picking up speed — best of the three I\\'ve watched."),
    ("첫 화가 정말 좋았다. 관심을 확 잡아끌었다.",
     "First episode was great — really grabbed me."),
    ("두 사람 사이의 상황에 관심이 잡혔다. 이 드라마 정말 즐기고 있다.",
     "Hooked on their dynamic — really enjoying this drama."),
    ("에피소드가 정말 즐거웠다. 아이가 등장해서 다음에 뭐가 나올지 관심이 갔다.",
     "Really fun episode — the kid showed up and I wanted to see what\\'s next."),
    ("아버지가 자기 아이인지 모른 채 대화를 나누는 장면이 인상적이었다.",
     "The father talking without knowing it\\'s his kid — striking scene."),
    ("면접관이 그 여자를 아는 것 같은 부분, 복도에서 만나는 장면에서 흥미도가 올라갔다.",
     "When the interviewer seemed to know her, hallway meet — interest spiked."),
    ("여주가 CEO 비서로 취직됐다. 두 사람이 물리적으로 많이 가까워졌다. 매우 극적이었다.",
     "She got the CEO secretary job — they\\'re physically close now. Very dramatic."),
    ("이 에피소드에서 대화가 더 많아졌다. 드라마도 없고 액션도 없고 그냥 대화만 많았다.",
     "This ep was mostly talk — no drama, no action, just dialogue."),
    ("애니메이션을 별로 좋아하지 않고, 이해 못하는 언어로 된 걸 보는 게 어렵다. 그래도 전체적으로 1점.",
     "I don\\'t love anime, and a language I don\\'t get is hard — still overall a 1."),
    ("봐야 해서 보는 거다. 그래도 액션이 꽤 있어서 평소보다 관심이 더 생겼다.",
     "Watching because I have to — but decent action, more interest than usual."),
    ("대화가 너무 많았다. 주인공이 혼자 독백하는 장면이 많아 흥미롭지 않았다.",
     "Too much talk — lots of solo monologue, not engaging."),
    ("갑자기 부자가 되는 장면이 이해가 안 됐다.",
     "Suddenly rich — didn\\'t make sense."),
    ("새로운 캐릭터 등장이 흥미로웠다.",
     "New character was interesting."),
    ("레벨업에 대해 무슨 일인지 이해를 못 하겠다.",
     "Couldn\\'t follow what was going on with the level-ups."),
    ("뱀파이어가 정말 좋다. 드라마적인 요소도 있어서 좋다. 이걸 직접 고르겠다고 할 만큼 마음에 들었다.",
     "Love the vampire angle and the drama — I\\'d pick this myself."),
    ("1화에서 처음 만났는데 2화에서 갑자기 성에 함께 있는 걸로 넘어갔다. 설명이 없어서 조금 방해가 됐다.",
     "Met in Ep.1, suddenly together in a castle in Ep.2 — no explanation, a bit jarring."),
    ("AI가 만든 것 같은 느낌이 강하게 들어서 거부감이 생겼다. 목소리 톤의 변화가 없고 너무 로봇 같다.",
     "Strong AI-made vibe — put me off. Voice has no range, too robotic."),
    ("더 극적인 장면들이 나왔다. 거의 늑대로 변할 것 같은 장면, 싸우는 장면.",
     "More dramatic — almost wolfing out, fight scenes."),
    ("매우 흥미로운 에피소드였다. 늑대인지 뱀파이어인지 헷갈리지만 전체적으로 흥미로웠다.",
     "Very engaging — wolf or vampire was confusing but overall interesting."),
    ("새로운 남자가 들어오면서 흥미도가 올라갔다. 전체적인 인상은 2점이다.",
     "New guy raised interest — overall impression 2."),
    ("애니메이션이 취향이 아니고 동물 캐릭터를 이해하기 어렵다.",
     "Anime isn\\'t my thing — hard to parse the animal characters."),
    ("액션 장면이 몇 개 있었고, 이전 에피소드보다 발전하는 것들이 있었다.",
     "Some action — felt like progress vs the last episode."),
    ("액션이 쌓이고 무슨 일인지 설명이 조금씩 더 나오기 시작했다.",
     "Action building — explanations slowly starting to land."),
    ("이 에피소드에서 시리즈가 더 발전하는 것 같았다. 다른 에피소드들보다 훨씬 흥미로웠다.",
     "Felt like the series moved forward — way more interesting than other eps."),
    ("별로 흥미롭지 않았다. 알에서 여자아이가 나오는 게 왜 그런지도 모르겠다.",
     "Not very engaging — girl hatching from an egg made no sense to me."),
    ("여자 캐릭터가 남자를 도와주는 장면이 흥미로웠다. 이 애니메이션의 전체 포인트가 뭔지 여전히 모르겠다.",
     "Her helping him was interesting — still don\\'t get the show\\'s point."),
]

for ko, en in QUOTE_PAIRS:
    src = src.replace(f"quote: '{ko}'", f"quote: '{en}'")

# USERS block (must match index.html exactly)
OLD_USERS = """const USERS = [
  {
    name: 'Hector',
    fullName: 'Hector Lopez',
    initials: 'HE',
    seriesIndices: [0, 1, 2, 3],
    meta: '참여자 01 · 33세 남성 · 인디애나 클락스빌',
    personaType: '애니메이션 탐험가',
    quote: '"예측 가능한 이야기는 바로 흥미를 잃는다. 오리지널하고 예상치 못한 전개가 필요하다."',
    insights: [
      { lbl: '직업·배경', val: '농업 물류 회사 디렉터 · 멕시코계 미국인' },
      { lbl: '시청 맥락', val: '업무 휴식 중 TikTok 단편 영상 · 야간 애니메이션 감상' },
      { lbl: '선호 장르', val: '이세카이·성장물·액션·악당 주인공 서사 · 예측 불가한 전개' },
      { lbl: '결제 행동', val: '만화/웹툰 월 $10 지출 · 숏폼 드라마 결제 경험 없음' },
      { lbl: 'AI 콘텐츠', val: '조건부 수용 — "자연스럽게 만들어지면 괜찮다"' },
    ],
    painTags: ['Twilight 반복 클리셰', '예측 가능한 스토리', '광고 중단'],
    preferTags: ['캐릭터 성장·레벨업', '예상 밖 전개', '액션·판타지', '롤플레잉 요소'],
  },
  {
    name: 'Dani',
    fullName: 'Danielle Ramirez',
    initials: 'DA',
    seriesIndices: [4, 5, 6, 7],
    meta: '참여자 02 · 31세 여성 · 시애틀 워싱턴',
    personaType: '감성 도파민 소비자',
    quote: '"AI가 만든 것 같다는 느낌이 드는 콘텐츠는 정말 불편하다. 인간적인 감정과 깊이가 없다."',
    insights: [
      { lbl: '직업·배경', val: '은행 재봉사 · 이스라엘 출신, 미국 거주' },
      { lbl: '시청 맥락', val: '업무 휴식 중 5~10분 숏폼 시청 · 저녁 Netflix 시청' },
      { lbl: '선호 장르', val: '현대 로맨스·로코·직장 로맨스·복수극 · 여행 배경 스토리' },
      { lbl: '결제 행동', val: '결제 경험 없음 · 광고 기반 무료 시청 · 과도한 광고 즉시 이탈' },
      { lbl: 'AI 콘텐츠', val: '강한 거부감 — "로봇 같고 인간적 감정이 없다"' },
    ],
    painTags: ['과도한 광고', 'AI 생성 느낌', '너무 짧은 에피소드'],
    preferTags: ['현대 로맨스', '직장·여행 배경', '감정선 있는 드라마', '롬코미'],
  },
];"""

NEW_USERS = """const USERS = [
  {
    name: 'Hector',
    fullName: 'Hector Lopez',
    initials: 'HE',
    seriesIndices: [0, 1, 2, 3],
    meta: 'Participant 01 · Male, 33 · Clarksville, IN',
    personaType: 'Anime explorer',
    quote: '"Predictable stories lose me instantly — I need original, unexpected turns."',
    insights: [
      { lbl: 'Role & background', val: 'Ag logistics director · Mexican American' },
      { lbl: 'Viewing context', val: 'TikTok shorts on work breaks · late-night anime' },
      { lbl: 'Preferred genres', val: 'Isekai, growth arcs, action, villain leads, unpredictable plots' },
      { lbl: 'Spending', val: '~$10/mo manga/webtoon · no short-drama purchases' },
      { lbl: 'AI content', val: 'Conditional — "fine if it feels natural"' },
    ],
    painTags: ['Twilight-style clichés', 'Predictable plots', 'Ad interruptions'],
    preferTags: ['Character growth & level-ups', 'Surprise twists', 'Action & fantasy', 'RPG vibes'],
  },
  {
    name: 'Dani',
    fullName: 'Danielle Ramirez',
    initials: 'DA',
    seriesIndices: [4, 5, 6, 7],
    meta: 'Participant 02 · Female, 31 · Seattle, WA',
    personaType: 'Emotional dopamine viewer',
    quote: '"Content that feels AI-made is uncomfortable — no human emotion or depth."',
    insights: [
      { lbl: 'Role & background', val: 'Bank teller · from Israel, US-based' },
      { lbl: 'Viewing context', val: '5–10 min shorts on breaks · Netflix evenings' },
      { lbl: 'Preferred genres', val: 'Modern romance, rom-com, office romance, revenge, travel backdrops' },
      { lbl: 'Spending', val: 'No paid drama · ad-supported free · bails on heavy ads' },
      { lbl: 'AI content', val: 'Strong aversion — "robotic, no human feeling"' },
    ],
    painTags: ['Too many ads', 'AI-generated feel', 'Episodes too short'],
    preferTags: ['Modern romance', 'Office & travel settings', 'Emotional drama', 'Rom-com'],
  },
];"""

if OLD_USERS not in src:
    raise SystemExit("USERS block mismatch — index.html may have changed")
src = src.replace(OLD_USERS, NEW_USERS, 1)

OLD_EVAL = """const CONTENT_EVAL = [
  {
    title: 'Vicious', thumb: 'vicious.png', type: 'Human',
    ratings: {
      Hector: {
        trail: [1,-1,-1,3,-3,-3,-1,null,1], verdictType: 'negative', verdictLabel: 'Switch 이탈',
        quote: '"sex sells 방식 하나로만 끌고 가는 구조 — 뭔가 있을까 하는 기대가 유일한 생명줄이었다."',
      },
      Dani: null,
    },
    pros: ['강렬한 첫 오프닝', '성적·로맨틱 긴장감', '매력적인 배우'],
    cons: ['예측 가능한 클리셰', '고등학교 트로프', '비자연적 인물 반응', '반복적 고난 구조'],
  },
  {
    title: 'Trapped and Redeemed', thumb: 'trapped and redeemed.png', type: 'Human',
    ratings: {
      Hector: null,
      Dani: {
        trail: [3,3,3,2,2,3,1], verdictType: 'neutral', verdictLabel: 'Switch',
        quote: '"첫 화 바에서의 만남이 완벽한 티저였다 — 비밀 아이 반전에서 모든 게 멈추는 느낌이었다."',
      },
    },
    pros: ['강력한 첫 화 훅', '직장·CEO 로맨스 설정', '비밀 아이 반전', '역할 역학 긴장감'],
    cons: ['과도한 대화 씬', '드라마 없는 장면 반복', '광고 시스템 오류 이탈'],
  },
  {
    title: 'Blood Bound Lunar', thumb: 'luna.png', type: 'AI',
    ratings: {
      Hector: {
        trail: [-1,0,-1,-3,-3,-3], verdictType: 'negative', verdictLabel: 'Switch 이탈',
        quote: '"진짜 Twilight 그대로 가버렸다 — 100% 예측 가능, 오리지널이 될 가능성이 없다."',
      },
      Dani: {
        trail: [3,3,1,3,3,2], verdictType: 'neutral', verdictLabel: 'Switch',
        quote: '"뱀파이어 정말 좋은데 — AI가 만든 목소리가 너무 로봇 같아서 거부감이 생겼다."',
      },
    },
    pros: ['뱀파이어 장르 자체 매력 (Dani)', '액션·싸움 장면', '로맨틱 긴장감'],
    cons: ['Twilight 완전 복사 (Hector)', 'AI 목소리 부자연 (Dani)', '에피소드 간 연결 단절', '세계관 설명 없음'],
  },
  {
    title: 'Everyone Awakens', thumb: 'everyone rules.png', type: 'AI',
    ratings: {
      Hector: {
        trail: [1,3,1,0,0,1], verdictType: 'neutral', verdictLabel: 'Switch',
        quote: '"오리지널한 세계관이 좋다 — 레벨업 장면 없이 이미 레벨30, 액션이 너무 적다."',
      },
      Dani: {
        trail: [1,1,2,1,1,0], verdictType: 'negative', verdictLabel: 'Switch 이탈',
        quote: '"처음부터 설명이 없어서 몇 화를 봐도 전체 흐름을 파악하지 못했다."',
      },
    },
    pros: ['독창적 세계관 (Hector)', '언더독 성장 서사', '운석 OP 주인공 설정'],
    cons: ['레벨업 화면 미표시', '애니메이션 거부감 (Dani)', '언어 장벽 (Dani)', '화면 액션 부족'],
  },
  {
    title: 'Last Dragon Tamer', thumb: 'dragon tamer.png', type: 'AI',
    ratings: {
      Hector: {
        trail: [1,1,1,3], verdictType: 'positive', verdictLabel: '계속 의향 ★',
        quote: '"지금까지 본 작품 중 가장 좋다 — 드래곤이 어떻게 전개될지 기대된다."',
      },
      Dani: {
        trail: [1,2,2,3,1,2], verdictType: 'neutral', verdictLabel: '완료',
        quote: '"애니메이션은 취향이 아닌데, 액션이 쌓이고 설명이 조금씩 나오기 시작했다."',
      },
    },
    pros: ['코미디·세계관 다양성 (Hector)', '빠른 전개', '드래곤 설정 기대감', '액션 장면'],
    cons: ['애니메이션 거부감 (Dani)', '언어 장벽 (Dani)', '여자친구 급전개', '세계관 이해 어려움'],
  },
];"""

NEW_EVAL = """const CONTENT_EVAL = [
  {
    title: 'Vicious', thumb: 'vicious.png', type: 'Human',
    ratings: {
      Hector: {
        trail: [1,-1,-1,3,-3,-3,-1,null,1], verdictType: 'negative', verdictLabel: 'Switched away',
        quote: '"Sex-sells was the only engine — hope something would happen was the lifeline."',
      },
      Dani: null,
    },
    pros: ['Strong cold open', 'Sexual/romantic tension', 'Charismatic cast'],
    cons: ['Predictable clichés', 'High-school tropes', 'Unnatural reactions', 'Repeat suffering beats'],
  },
  {
    title: 'Trapped and Redeemed', thumb: 'trapped and redeemed.png', type: 'Human',
    ratings: {
      Hector: null,
      Dani: {
        trail: [3,3,3,2,2,3,1], verdictType: 'neutral', verdictLabel: 'Switch',
        quote: '"Bar meet in Ep.1 was a perfect teaser — secret-kid twist felt like everything stalled."',
      },
    },
    pros: ['Powerful Ep.1 hook', 'Office/CEO romance setup', 'Secret child twist', 'Power-dynamic tension'],
    cons: ['Talk-heavy scenes', 'Low-drama stretches', 'Ad glitch dropout'],
  },
  {
    title: 'Blood Bound Lunar', thumb: 'luna.png', type: 'AI',
    ratings: {
      Hector: {
        trail: [-1,0,-1,-3,-3,-3], verdictType: 'negative', verdictLabel: 'Switched away',
        quote: '"Went full Twilight — 100% predictable, zero chance of feeling original."',
      },
      Dani: {
        trail: [3,3,1,3,3,2], verdictType: 'neutral', verdictLabel: 'Switch',
        quote: '"Love the vampire angle — AI voices felt robotic and off-putting."',
      },
    },
    pros: ['Vampire genre pull (Dani)', 'Action/fight beats', 'Romantic tension'],
    cons: ['Twilight clone (Hector)', 'Unnatural AI voices (Dani)', 'Weak ep-to-ep continuity', 'Thin worldbuilding'],
  },
  {
    title: 'Everyone Awakens', thumb: 'everyone rules.png', type: 'AI',
    ratings: {
      Hector: {
        trail: [1,3,1,0,0,1], verdictType: 'neutral', verdictLabel: 'Switch',
        quote: '"Original world I liked — skipped to level 30 with no level-up scenes, too little action."',
      },
      Dani: {
        trail: [1,1,2,1,1,0], verdictType: 'negative', verdictLabel: 'Switched away',
        quote: '"No setup from the start — watched several eps and still couldn\\'t follow the arc."',
      },
    },
    pros: ['Distinct world (Hector)', 'Underdog growth story', 'Meteor OP lead'],
    cons: ['Level-ups not shown', 'Anime resistance (Dani)', 'Language barrier (Dani)', 'Thin on-screen action'],
  },
  {
    title: 'Last Dragon Tamer', thumb: 'dragon tamer.png', type: 'AI',
    ratings: {
      Hector: {
        trail: [1,1,1,3], verdictType: 'positive', verdictLabel: 'Would continue ★',
        quote: '"Best of what I\\'ve seen — curious how the dragon thread plays out."',
      },
      Dani: {
        trail: [1,2,2,3,1,2], verdictType: 'neutral', verdictLabel: 'Finished',
        quote: '"Anime isn\\'t my thing, but action stacked and explanations slowly landed."',
      },
    },
    pros: ['Comedy & variety (Hector)', 'Pacing', 'Dragon hook', 'Action beats'],
    cons: ['Anime resistance (Dani)', 'Language barrier (Dani)', 'Rushed romance', 'Hard to parse world rules'],
  },
];"""

if OLD_EVAL not in src:
    raise SystemExit("CONTENT_EVAL block mismatch")
src = src.replace(OLD_EVAL, NEW_EVAL, 1)

# Static HTML + JS UI
src = src.replace('<html lang="ko">', '<html lang="en">', 1)
src = src.replace(
    "<title>흥미도 타임라인 | Vigloo × Proby</title>",
    "<title>Interest Timeline | Vigloo × Proby</title>",
    1,
)

src = src.replace(
    """        <div style="margin-bottom:.75rem;">
          <a href="index_en.html" style="font-size:.72rem;color:rgba(0,237,212,.55);text-decoration:none;border:1px solid rgba(0,237,212,.25);padding:.25rem .55rem;border-radius:.35rem;">English</a>
        </div>
        <h1 style="font-size:2.6rem;font-weight:900;letter-spacing:-.03em;line-height:1.15;margin-bottom:.75rem;">
          <span class="grad-text">시청 흥미도</span><br>타임라인
        </h1>
        <p style="font-size:.88rem;color:rgba(255,255,255,.42);max-width:480px;line-height:1.75;margin-bottom:.3rem;">
          숏드라마를 시청하며 발화한 흥미도 점수를 에피소드 단위로 시각화합니다.
        </p>
        <p style="font-size:.75rem;color:rgba(0,237,212,.3);max-width:520px;line-height:1.65;">
          어느 장면에서 몰입이 오르고, 어느 지점에서 이탈 신호가 나타나는지 확인할 수 있습니다.
        </p>""",
    """        <div style="margin-bottom:.75rem;">
          <a href="index.html" style="font-size:.72rem;color:rgba(0,237,212,.55);text-decoration:none;border:1px solid rgba(0,237,212,.25);padding:.25rem .55rem;border-radius:.35rem;">한국어</a>
        </div>
        <h1 style="font-size:2.6rem;font-weight:900;letter-spacing:-.03em;line-height:1.15;margin-bottom:.75rem;">
          <span class="grad-text">Viewing interest</span><br>timeline
        </h1>
        <p style="font-size:.88rem;color:rgba(255,255,255,.42);max-width:480px;line-height:1.75;margin-bottom:.3rem;">
          Interest scores spoken while watching short dramas, visualized by episode.
        </p>
        <p style="font-size:.75rem;color:rgba(0,237,212,.3);max-width:520px;line-height:1.65;">
          See where engagement rises and where dropout signals show up.
        </p>""",
    1,
)

src = src.replace(
    '      <span class="ct-chart-bar-label">흥미도 타임라인</span>\n      <span class="ct-chart-bar-hint">에피소드별 시청 진행률 · hover → 발언 인용구</span>',
    '      <span class="ct-chart-bar-label">Interest timeline</span>\n      <span class="ct-chart-bar-hint">Per-episode watch progress · hover for spoken quotes</span>',
    1,
)
src = src.replace(
    '          데이터가 없습니다',
    '          No data',
    1,
)

src = src.replace('title="이전 참여자"', 'title="Previous participant"', 1)
src = src.replace('title="다음 참여자"', 'title="Next participant"', 1)
src = src.replace(
    '        <div class="upanel-tags-lbl">선호 요소</div>',
    '        <div class="upanel-tags-lbl">Preferences</div>',
    1,
)

src = src.replace(
    'letter-spacing=".5" transform="rotate(-90 12 ${midY})">흥미도</text>`;',
    'letter-spacing=".5" transform="rotate(-90 12 ${midY})">Interest</text>`;',
    1,
)

src = src.replace(
    'font-size="9" font-family="Pretendard,sans-serif" letter-spacing="1">에피소드별 시청 진행률</text>`;',
    'font-size="9" font-family="Pretendard,sans-serif" letter-spacing="1">Per-episode watch progress</text>`;',
    1,
)

src = src.replace(
    'axes += `<text x="${x+6}" y="${PT+12}" fill="rgba(163,194,239,.55)" font-size="9"\n                     font-weight="700" font-family="Pretendard,sans-serif">${ep+1}화</text>`;',
    'axes += `<text x="${x+6}" y="${PT+12}" fill="rgba(163,194,239,.55)" font-size="9"\n                     font-weight="700" font-family="Pretendard,sans-serif">Ep.${ep+1}</text>`;',
    1,
)

src = src.replace(
    "const scoreLabel = d !== null ? fmtScore(d) + '점' : '—';",
    "const scoreLabel = d !== null ? fmtScore(d) + ' pts' : '—';",
    1,
)

src = src.replace(
    """    document.getElementById('tip-score').innerHTML = `<div class="ct-tip-dropout-label">이탈 포인트</div>`;
    document.getElementById('tip-time').textContent = p.label ? `${p.label} — 시청 중단` : '시청 중단';""",
    """    document.getElementById('tip-score').innerHTML = `<div class="ct-tip-dropout-label">Drop-off</div>`;
    document.getElementById('tip-time').textContent = p.label ? `${p.label} — stopped watching` : 'Stopped watching';""",
    1,
)
src = src.replace(
    'document.getElementById(\'tip-score\').innerHTML = `<span style="color:${col};">${fmtScore(d)}</span><span>점</span>`;',
    'document.getElementById(\'tip-score\').innerHTML = `<span style="color:${col};">${fmtScore(d)}</span><span> pts</span>`;',
    1,
)

src = src.replace(
    '        <div style="font-size:.46rem;color:rgba(255,255,255,.14);font-style:italic;flex:1;">미시청</div>',
    '        <div style="font-size:.46rem;color:rgba(255,255,255,.14);font-style:italic;flex:1;">Did not watch</div>',
    1,
)

src = src.replace(
    '          <div class="eval-tag-lbl pro">흥미 유발</div>',
    '          <div class="eval-tag-lbl pro">Engagement drivers</div>',
    1,
)
src = src.replace(
    '          <div class="eval-tag-lbl con">흥미 저해</div>',
    '          <div class="eval-tag-lbl con">Engagement drag</div>',
    1,
)

src = src.replace(
    '      <div class="eval-section-hdr-title">작품별 종합 평가</div>',
    '      <div class="eval-section-hdr-title">Per-title summary</div>',
    1,
)

(ROOT / "index_en.html").write_text(src, encoding="utf-8")
print("Wrote", ROOT / "index_en.html")
