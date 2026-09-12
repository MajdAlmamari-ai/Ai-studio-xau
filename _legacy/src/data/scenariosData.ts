import { SMCScenario } from '../types';

export function getSMCScenarios(currentPrice: number, bsl: number, ssl: number, resistance: number, support: number): SMCScenario[] {
  return [
    {
      id: 'scenario-bullish-expansion',
      titleAr: 'السيناريو الأول: التوسع الصاعد واستكمال الهيكل المؤسساتي (Bullish Continuation)',
      type: 'BULLISH_EXPANSION',
      probability: 72,
      triggerConditionAr: `إغلاق شمعة 15 دقيقة أعلى من قمة المقاومة الحالية $${resistance}.00 مع فوليوم شرائي متصاعد.`,
      entryRange: {
        min: Number((currentPrice - 0.8).toFixed(2)),
        max: Number((currentPrice + 0.4).toFixed(2)),
      },
      invalidationLevel: Number((support - 1.5).toFixed(2)),
      targetTakeProfits: [
        Number((bsl).toFixed(2)),
        Number((bsl + 6.0).toFixed(2)),
        Number((bsl + 14.0).toFixed(2)),
      ],
      riskReward: '1:3.2',
      rationaleAr: `يستند السيناريو إلى ارتداد السعر من أوردر بلوك الطلب (Demand OB) وامتصاص عروض البيع. كسر سيولة الشراء (BSL) عند $${bsl}.00 سيفعل أوامر الشراء المعلقة ويطلق توسعاً نحو الأهداف العليا.`,
    },
    {
      id: 'scenario-bearish-breakdown',
      titleAr: 'السيناريو الثاني: كسر الهيكل الهبوطي ومصيدة الشراء (Liquidity Sweep & Dump)',
      type: 'BEARISH_BREAKDOWN',
      probability: 21,
      triggerConditionAr: `فشل السعر في الحفاظ على دعم $${support}.00 وحدوث كسر هيكل واضح (BOS) بإغلاق شمعة زخم سلبية.`,
      entryRange: {
        min: Number((support + 0.5).toFixed(2)),
        max: Number((support - 0.5).toFixed(2)),
      },
      invalidationLevel: Number((resistance + 2.0).toFixed(2)),
      targetTakeProfits: [
        Number((ssl).toFixed(2)),
        Number((ssl - 7.0).toFixed(2)),
        Number((ssl - 15.0).toFixed(2)),
      ],
      riskReward: '1:2.8',
      rationaleAr: `في حال حدوث رفض حاد عند أوردر بلوك العرض واختراق خط الدعم، سيقوم صانع السوق بسحب أوامر وقف الخسارة للمشترين المتمركزة عند سيولة البيع (SSL) عند $${ssl}.00.`,
    },
    {
      id: 'scenario-range-accumulation',
      titleAr: 'السيناريو الثالث: التجميع الأفقي وفخاخ السيولة على الطرفين (Range & AMD Phase)',
      type: 'RANGE_ACCUMULATION',
      probability: 7,
      triggerConditionAr: `استمرار تداول السعر بين الدعم $${support}.00 والمقاومة $${resistance}.00 دون كسر هيكلي مؤكد.`,
      entryRange: {
        min: Number((support + 0.4).toFixed(2)),
        max: Number((resistance - 0.4).toFixed(2)),
      },
      invalidationLevel: Number((support - 3.0).toFixed(2)),
      targetTakeProfits: [
        Number(((support + resistance) / 2).toFixed(2)),
        Number((resistance).toFixed(2)),
      ],
      riskReward: '1:1.6',
      rationaleAr: `مرحلة تجميع وتوزيع (Accumulation - Manipulation - Distribution) يفضل فيها عدم المغامرة بصفقات متوسطة المدى، والاكتفاء بالمضاربة السريعة (Scalp) بين حدي النطاق حتى يتضح اتجاه صانع السوق.`,
    },
  ];
}

export const SMC_SCENARIOS = getSMCScenarios(4478.5, 4486.5, 4472.5, 4482.0, 4475.0);
