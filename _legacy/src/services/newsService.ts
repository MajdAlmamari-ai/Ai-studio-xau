import { EconomicNewsItem } from '../types';

export const GOLD_ECONOMIC_NEWS: EconomicNewsItem[] = [
  {
    id: 'news-cpi-us',
    titleAr: 'مؤشر أسعار المستهلكين الأمريكي (CPI) السنوي',
    source: 'مكتب إحصاءات العمل الأمريكي (BLS)',
    time: 'اليوم - 15:30 بتوقيت مكة',
    category: 'INFLATION',
    impact: 'HIGH',
    actual: '2.9%',
    forecast: '3.1%',
    previous: '3.2%',
    goldImpactAr: 'تراجع التضخم يدعم خفض الفائدة الأمريكية من قِبل الفيدرالي، مما يُضعف مؤشر الدولار (DXY) ويدفع أسعار الذهب (XAUUSD) نحو مستويات سيولة شرائية قياسية.',
    directionalBias: 'BULLISH',
  },
  {
    id: 'news-fomc-rates',
    titleAr: 'قرار الفائدة الصادر عن البنك الفيدرالي الأمريكي (FOMC)',
    source: 'Federal Reserve Board',
    time: 'غداً - 21:00 بتوقيت مكة',
    category: 'INTEREST_RATE',
    impact: 'HIGH',
    forecast: '4.50%',
    previous: '4.75%',
    goldImpactAr: 'توقعات بخفض 25 نقطة أساس. أسعار الفائدة المنخفضة تقلل تكلفة الفرصة البديلة لحيازة المعدن النفيس غير المدر للعائد وتؤدي إلى توسع صاعد حاد.',
    directionalBias: 'BULLISH',
  },
  {
    id: 'news-nfp-jobs',
    titleAr: 'تقرير الوظائف غير الزراعية الأمريكية (NFP)',
    source: 'وزارة العمل الأمريكية',
    time: 'الجمعة - 15:30 بتوقيت مكة',
    category: 'EMPLOYMENT',
    impact: 'HIGH',
    forecast: '165K',
    previous: '182K',
    goldImpactAr: 'أي قراءة دون التوقعات تؤكد تباطؤ سوق العمل وتدفع الذهب لكسر مناطق المقاومة الحالية واختبار أوردر بلوك العرض.',
    directionalBias: 'VOLATILITY',
  },
  {
    id: 'news-central-banks',
    titleAr: 'تقرير مشتريات البنوك المركزية للذهب (WGC)',
    source: 'World Gold Council',
    time: 'تحديث هذا الأسبوع',
    category: 'CENTRAL_BANK',
    impact: 'MEDIUM',
    actual: '+48 طن صافي',
    previous: '+36 طن',
    goldImpactAr: 'استمرار بنك الشعب الصيني والبنوك المركزية العالمية في تكديس احتياطيات الذهب يدعم قاعاً سعرياً مؤسساتياً صلب فوق 4400 دولار.',
    directionalBias: 'BULLISH',
  },
  {
    id: 'news-geopolitics',
    titleAr: 'تصاعد التوترات الجيوسياسية وملاذات الأمان',
    source: 'رويترز / رصد الأسواق العالمية',
    time: 'مباشر - مستمر',
    category: 'GEOPOLITICAL',
    impact: 'MEDIUM',
    goldImpactAr: 'تزايد الطلب على الذهب كملاذ آمن للتحوط ضد مخاطر اضطراب سلاسل الإمداد وممرات الشحن العالمية.',
    directionalBias: 'BULLISH',
  },
  {
    id: 'news-dxy-index',
    titleAr: 'مؤشر الدولار الأمريكي (DXY) يختبر دعماً رئيسياً عند 101.40',
    source: 'Intercontinental Exchange (ICE)',
    time: 'تحديث الجلسة الأمريكية',
    category: 'INFLATION',
    impact: 'MEDIUM',
    actual: '101.35',
    previous: '102.10',
    goldImpactAr: 'علاقة عكسية قوية: كسر مؤشر الدولار لمستويات الدعم يولد تدفقات شرائية فورية للذهب الفوري والعقود الآجلة.',
    directionalBias: 'BULLISH',
  },
];

export async function fetchLiveEconomicNews(): Promise<EconomicNewsItem[]> {
  try {
    const res = await fetch('/api/news');
    if (res.ok) {
      const data = await res.json();
      const list = Array.isArray(data) ? data : data?.news;
      if (Array.isArray(list) && list.length > 0) {
        return list;
      }
    }
  } catch (e) {
    // Fallback
  }
  return GOLD_ECONOMIC_NEWS;
}
