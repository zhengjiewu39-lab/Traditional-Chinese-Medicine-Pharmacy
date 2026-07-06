/**
 * Demo herb catalog + prescription templates for full workflow demonstration.
 */

function herb(id, name, pinyin, category, nature, meridians, commonDosage, price, unit, functions, contraindications, stock, supplier) {
  return {
    id,
    name,
    pinyin,
    category,
    nature,
    meridians,
    commonDosage,
    price,
    unit,
    functions,
    contraindications,
    stock: stock ?? 100,
    minStock: Math.max(20, Math.floor((stock ?? 100) * 0.3)),
    supplier: supplier || '道地药材供应',
    expiryDate: '2027-06-30',
    batchNo: `H${String(id).padStart(4, '0')}`,
  };
}

const CATALOG_HERBS = [
  herb(1, '人参', 'renshen', '补气药', '甘微苦温', '脾、肺经', '3-9g', 120, '克', '大补元气，复脉固脱', '实证、热病初起慎用', 50, '吉林参厂'),
  herb(2, '当归', 'danggui', '补血药', '甘温', '肝、心、脾经', '6-15g', 50, '克', '补血活血，调经止痛', '湿盛便溏者慎用', 150, '甘肃岷县'),
  herb(3, '黄芪', 'huangqi', '补气药', '甘温', '肺、脾经', '10-30g', 30, '克', '补气升阳，益卫固表', '表实邪盛慎用', 200, '内蒙古'),
  herb(4, '川芎', 'chuanxiong', '活血化瘀', '辛温', '肝、胆经', '3-9g', 45, '克', '活血行气，祛风止痛', '孕妇慎用', 90, '四川都江堰'),
  herb(5, '白芍', 'baishao', '补血药', '苦酸微寒', '肝、脾经', '6-15g', 38, '克', '养血敛阴，柔肝止痛', '虚寒腹泻慎用', 120, '浙江磐安'),
  herb(6, '甘草', 'gancao', '补气药', '甘平', '心、肺、脾、胃经', '3-10g', 18, '克', '益气补中，调和诸药', '水肿、高血压慎用', 300, '内蒙古'),
  herb(7, '熟地黄', 'shudihuang', '补血药', '甘温', '肝、肾经', '10-30g', 42, '克', '滋阴补血，益精填髓', '脾虚便溏慎用', 110, '河南武陟'),
  herb(8, '生地黄', 'shengdihuang', '清热药', '甘寒', '心、肝、肾经', '10-30g', 35, '克', '清热凉血，养阴生津', '脾虚湿滞慎用', 95, '河南武陟'),
  herb(9, '丹参', 'danshen', '活血化瘀', '微寒', '心、肝经', '10-15g', 48, '克', '活血祛瘀，凉血消痈', '出血倾向慎用', 85, '四川中江'),
  herb(10, '茯苓', 'fuling', '利水渗湿', '甘淡平', '心、脾、肾经', '9-15g', 22, '克', '利水渗湿，健脾宁心', '阴虚津亏慎用', 180, '云南楚雄'),
  herb(11, '白术', 'baizhu', '补气药', '甘温', '脾、胃经', '6-12g', 28, '克', '健脾益气，燥湿利水', '阴虚内热慎用', 140, '浙江于潜'),
  herb(12, '陈皮', 'chenpi', '理气药', '辛苦温', '肺、脾经', '3-10g', 20, '克', '理气健脾，燥湿化痰', '阴虚燥咳慎用', 160, '广东新会'),
  herb(13, '半夏', 'banxia', '化痰止咳', '辛温', '脾、胃经', '3-9g', 55, '克', '燥湿化痰，降逆止呕', '孕妇慎用', 70, '四川南充'),
  herb(14, '桂枝', 'guizhi', '解表药', '辛甘温', '心、肺、膀胱经', '3-10g', 25, '克', '发汗解肌，温通经脉', '阴虚火旺慎用', 100, '广西'),
  herb(15, '麻黄', 'mahuang', '解表药', '辛微苦温', '肺、膀胱经', '3-9g', 40, '克', '发汗解表，宣肺平喘', '高血压、失眠慎用', 60, '内蒙古'),
  herb(16, '附子', 'fuzi', '温里药', '大热', '心、肾、脾经', '3-15g', 80, '克', '回阳救逆，补火助阳', '孕妇禁用', 40, '四川江油'),
  herb(17, '干姜', 'ganjiang', '温里药', '辛热', '脾、胃、心、肺经', '3-10g', 24, '克', '温中散寒，回阳通脉', '阴虚内热慎用', 90, '四川'),
  herb(18, '黄连', 'huanglian', '清热药', '苦寒', '心、脾、胃经', '2-5g', 90, '克', '清热燥湿，泻火解毒', '脾胃虚寒慎用', 55, '四川洪雅'),
  herb(19, '黄芩', 'huangqin', '清热药', '苦寒', '肺、胆、胃经', '6-15g', 32, '克', '清热燥湿，泻火解毒', '虚寒者慎用', 120, '河北'),
  herb(20, '金银花', 'jinyinhua', '清热药', '甘寒', '肺、心、胃经', '6-15g', 65, '克', '清热解毒，疏散风热', '脾胃虚寒慎用', 130, '山东平邑'),
  herb(21, '连翘', 'lianqiao', '清热药', '苦微寒', '肺、心、小肠经', '6-15g', 38, '克', '清热解毒，消肿散结', '脾胃虚寒慎用', 110, '山西'),
  herb(22, '薄荷', 'bohe', '解表药', '辛凉', '肺、肝经', '3-6g', 28, '克', '疏散风热，清利头目', '表虚汗多慎用', 75, '江苏'),
  herb(23, '荆芥', 'jingjie', '解表药', '辛微温', '肺、肝经', '5-10g', 22, '克', '解表散风，透疹消疮', '血热妄行者慎用', 85, '江西'),
  herb(24, '桔梗', 'jiegeng', '化痰止咳', '苦辛平', '肺经', '3-9g', 26, '克', '宣肺，利咽，祛痰', '胃溃疡慎用', 95, '安徽'),
  herb(25, '杏仁', 'xingren', '化痰止咳', '苦温', '肺、大肠经', '5-10g', 30, '克', '降气止咳，润肠通便', '婴儿慎用', 80, '河北'),
  herb(26, '石膏', 'shigao', '清热药', '辛甘大寒', '肺、胃经', '15-60g', 12, '克', '清热泻火，除烦止渴', '脾胃虚寒慎用', 200, '湖北'),
  herb(27, '知母', 'zhimu', '清热药', '苦甘寒', '肺、胃、肾经', '6-12g', 34, '克', '清热泻火，滋阴润燥', '脾虚便溏慎用', 88, '河北'),
  herb(28, '葛根', 'gegen', '解表药', '甘辛凉', '脾、胃经', '9-15g', 24, '克', '解肌退热，生津止渴', '胃寒者慎用', 105, '湖南'),
  herb(29, '柴胡', 'chaihu', '解表药', '苦辛微寒', '肝、胆经', '3-9g', 45, '克', '和解表里，疏肝升阳', '肝阳上亢慎用', 92, '山西'),
  herb(30, '香附', 'xiangfu', '理气药', '辛微苦微温', '肝、脾、三焦经', '6-10g', 22, '克', '疏肝解郁，理气宽中', '气虚无滞慎用', 115, '浙江'),
  herb(31, '枳壳', 'zhiqiao', '理气药', '苦辛微寒', '脾、胃经', '3-10g', 20, '克', '理气宽中，行滞消胀', '孕妇慎用', 100, '江西'),
  herb(32, '厚朴', 'houpo', '理气药', '苦辛温', '脾、胃、肺经', '3-10g', 36, '克', '燥湿消痰，下气除满', '孕妇慎用', 78, '四川'),
  herb(33, '淫羊藿', 'yinyanghuo', '补阳药', '辛甘温', '肝、肾经', '6-12g', 42, '克', '补肾阳，强筋骨', '阴虚火旺慎用', 65, '甘肃'),
  herb(34, '枸杞子', 'gouqizi', '补阴药', '甘平', '肝、肾经', '6-15g', 55, '克', '滋补肝肾，益精明目', '脾虚便溏慎用', 150, '宁夏'),
  herb(35, '山药', 'shanyao', '补气药', '甘平', '脾、肺、肾经', '15-30g', 18, '克', '补脾养胃，生津益肺', '湿盛中满慎用', 170, '河南'),
  herb(36, '杜仲', 'duzhong', '补阳药', '甘温', '肝、肾经', '6-12g', 40, '克', '补肝肾，强筋骨', '阴虚火旺慎用', 72, '四川'),
  herb(37, '牛膝', 'niuxi', '活血化瘀', '苦甘酸平', '肝、肾经', '6-15g', 26, '克', '逐瘀通经，补肝肾', '孕妇禁用', 68, '河南'),
  herb(38, '三七', 'sanqi', '活血化瘀', '甘微苦温', '肝、胃经', '3-6g', 180, '克', '散瘀止血，消肿定痛', '孕妇慎用', 45, '云南文山'),
  herb(39, '红花', 'honghua', '活血化瘀', '辛温', '心、肝经', '3-10g', 70, '克', '活血通经，散瘀止痛', '孕妇禁用', 50, '新疆'),
  herb(40, '桃仁', 'taoren', '活血化瘀', '苦甘平', '心、肝、大肠经', '5-10g', 32, '克', '活血祛瘀，润肠通便', '孕妇禁用', 58, '山东'),
  herb(41, '板蓝根', 'banlangen', '清热药', '苦寒', '心、胃经', '10-30g', 20, '克', '清热解毒，凉血利咽', '脾胃虚寒慎用', 220, '甘肃'),
  herb(42, '甘遂', 'gansui', '泻下药', '苦寒', '肺、肾、大肠经', '0.5-1.5g', 95, '克', '泻水逐饮，消肿散结', '孕妇禁用', 25, '河南'),
  herb(43, '莱菔子', 'laifuzi', '消食药', '辛甘平', '肺、脾、胃经', '6-10g', 18, '克', '消食除胀，降气化痰', '气虚者慎用', 88, '安徽'),
  herb(44, '乌头', 'wutou', '温里药', '大热', '心、肝、脾经', '3-9g', 85, '克', '祛风除湿，温经止痛', '孕妇禁用', 20, '四川'),
  herb(45, '贝母', 'beimu', '化痰止咳', '苦微寒', '肺、心经', '3-9g', 58, '克', '清热化痰，止咳散结', '寒痰湿咳慎用', 62, '浙江'),
  herb(46, '沙参', 'shashen', '补阴药', '甘微寒', '肺、胃经', '9-15g', 36, '克', '养阴清肺，益胃生津', '风寒咳嗽慎用', 74, '安徽'),
  herb(47, '麦冬', 'maidong', '补阴药', '甘微苦微寒', '心、肺、胃经', '6-12g', 48, '克', '养阴生津，润肺清心', '脾胃虚寒慎用', 66, '浙江'),
  herb(48, '五味子', 'wuweizi', '收涩药', '酸甘温', '肺、心、肾经', '2-6g', 75, '克', '收敛固涩，益气生津', '表邪未解慎用', 52, '辽宁'),
  herb(49, '天麻', 'tianma', '平肝息风', '甘平', '肝经', '3-9g', 120, '克', '息风止痉，平抑肝阳', '血虚者慎用', 38, '云南'),
  herb(50, '薏苡仁', 'yiyiren', '利水渗湿', '甘淡凉', '脾、胃、肺经', '9-30g', 16, '克', '利水渗湿，健脾止泻', '孕妇慎用', 190, '福建'),
  herb(51, '藿香', 'huoxiang', '化湿药', '辛微温', '脾、胃、肺经', '3-10g', 24, '克', '芳香化浊，和中止呕', '阴虚血燥慎用', 82, '广东'),
  herb(52, '佩兰', 'peilan', '化湿药', '辛平', '脾、胃、肺经', '3-10g', 20, '克', '芳香化湿，醒脾开胃', '阴虚血燥慎用', 76, '江苏'),
  herb(53, '六味地黄丸', 'liuweidihuang', '丸剂', '—', '—', '8丸/次', 35.5, '瓶', '滋阴补肾', '脾虚便溏慎用', 1200, '同仁堂'),
  herb(54, '板蓝根颗粒', 'banlangenkeli', '颗粒剂', '—', '—', '1袋/次', 15.6, '盒', '清热解毒，凉血利咽', '脾胃虚寒慎用', 2000, '一方制药'),
  herb(55, '藿香正气水', 'huoxiangzhengqi', '合剂', '—', '—', '10ml/次', 22.8, '瓶', '解表化湿，理气和中', '酒精过敏禁用', 800, '广州白云山'),
  herb(56, '复方丹参片', 'fufangdanshen', '片剂', '—', '—', '3片/次', 32.5, '盒', '活血化瘀，理气止痛', '孕妇慎用', 1500, '天士力'),
  herb(57, '逍遥丸', 'xiaoyaowan', '丸剂', '—', '—', '8丸/次', 28, '盒', '疏肝健脾，养血调经', '阴虚火旺慎用', 980, '仲景'),
  herb(58, '金匮肾气丸', 'jinkuishenqi', '丸剂', '—', '—', '8丸/次', 32, '盒', '温补肾阳', '阴虚火旺慎用', 860, '同仁堂'),
  herb(59, '感冒灵颗粒', 'ganmaoling', '颗粒剂', '—', '—', '1袋/次', 12.5, '盒', '解热镇痛', '肝肾功能不全慎用', 1800, '华润三九'),
  herb(60, '连花清瘟胶囊', 'lianhuaqingwen', '胶囊', '—', '—', '4粒/次', 18, '盒', '清瘟解毒，宣肺泄热', '风寒感冒不适用', 1600, '以岭药业'),
  herb(61, '补中益气丸', 'buzhongyiqi', '丸剂', '—', '—', '8丸/次', 26, '盒', '补中益气，升阳举陷', '感冒发热慎用', 920, '同仁堂'),
  herb(62, '归脾丸', 'guipiwan', '丸剂', '—', '—', '8丸/次', 24, '盒', '益气补血，健脾养心', '实热证慎用', 880, '九芝堂'),
];

const PRESCRIPTION_TEMPLATES = [
  { id: 1, name: '四君子汤', category: '补气', indication: '脾胃气虚', herbs: [{ name: '人参', dosage: '9g' }, { name: '白术', dosage: '12g' }, { name: '茯苓', dosage: '12g' }, { name: '甘草', dosage: '6g' }], usage: '水煎服，日1剂', popularity: 95 },
  { id: 2, name: '四物汤', category: '补血', indication: '营血虚滞', herbs: [{ name: '当归', dosage: '12g' }, { name: '川芎', dosage: '8g' }, { name: '白芍', dosage: '12g' }, { name: '熟地黄', dosage: '15g' }], usage: '水煎服，日1剂', popularity: 92 },
  { id: 3, name: '银翘散', category: '解表', indication: '风热感冒', herbs: [{ name: '金银花', dosage: '15g' }, { name: '连翘', dosage: '12g' }, { name: '薄荷', dosage: '6g' }, { name: '荆芥', dosage: '9g' }, { name: '桔梗', dosage: '9g' }, { name: '甘草', dosage: '6g' }], usage: '水煎服，日1剂', popularity: 94 },
  { id: 4, name: '补中益气汤', category: '补气', indication: '中气下陷', herbs: [{ name: '黄芪', dosage: '20g' }, { name: '人参', dosage: '6g' }, { name: '白术', dosage: '10g' }, { name: '当归', dosage: '10g' }, { name: '陈皮', dosage: '6g' }, { name: '升麻', dosage: '6g' }, { name: '柴胡', dosage: '6g' }, { name: '甘草', dosage: '6g' }], usage: '水煎服，日1剂', popularity: 90 },
  { id: 5, name: '六味地黄汤', category: '补阴', indication: '肾阴虚', herbs: [{ name: '熟地黄', dosage: '24g' }, { name: '山药', dosage: '12g' }, { name: '茯苓', dosage: '9g' }, { name: '牡丹皮', dosage: '9g' }, { name: '泽泻', dosage: '9g' }, { name: '山茱萸', dosage: '12g' }], usage: '水煎服，日1剂', popularity: 88 },
  { id: 6, name: '逍遥散', category: '理气', indication: '肝郁脾虚', herbs: [{ name: '柴胡', dosage: '9g' }, { name: '当归', dosage: '12g' }, { name: '白芍', dosage: '12g' }, { name: '白术', dosage: '9g' }, { name: '茯苓', dosage: '12g' }, { name: '甘草', dosage: '6g' }, { name: '薄荷', dosage: '3g' }, { name: '生姜', dosage: '3g' }], usage: '水煎服，日1剂', popularity: 91 },
  { id: 7, name: '小柴胡汤', category: '和解', indication: '少阳证', herbs: [{ name: '柴胡', dosage: '12g' }, { name: '黄芩', dosage: '9g' }, { name: '人参', dosage: '6g' }, { name: '半夏', dosage: '9g' }, { name: '甘草', dosage: '6g' }, { name: '生姜', dosage: '9g' }, { name: '大枣', dosage: '4枚' }], usage: '水煎服，日1剂', popularity: 89 },
  { id: 8, name: '桂枝汤', category: '解表', indication: '风寒表虚', herbs: [{ name: '桂枝', dosage: '9g' }, { name: '白芍', dosage: '9g' }, { name: '生姜', dosage: '9g' }, { name: '大枣', dosage: '3枚' }, { name: '甘草', dosage: '6g' }], usage: '水煎服，日1剂', popularity: 87 },
  { id: 9, name: '麻黄汤', category: '解表', indication: '风寒表实', herbs: [{ name: '麻黄', dosage: '9g' }, { name: '桂枝', dosage: '6g' }, { name: '杏仁', dosage: '9g' }, { name: '甘草', dosage: '3g' }], usage: '水煎服，日1剂', popularity: 85 },
  { id: 10, name: '归脾汤', category: '补血', indication: '心脾两虚', herbs: [{ name: '人参', dosage: '6g' }, { name: '黄芪', dosage: '15g' }, { name: '白术', dosage: '9g' }, { name: '当归', dosage: '9g' }, { name: '茯苓', dosage: '9g' }, { name: '远志', dosage: '6g' }, { name: '酸枣仁', dosage: '12g' }, { name: '甘草', dosage: '6g' }], usage: '水煎服，日1剂', popularity: 86 },
  { id: 11, name: '血府逐瘀汤', category: '活血', indication: '胸中血瘀', herbs: [{ name: '桃仁', dosage: '12g' }, { name: '红花', dosage: '9g' }, { name: '当归', dosage: '9g' }, { name: '川芎', dosage: '6g' }, { name: '赤芍', dosage: '9g' }, { name: '柴胡', dosage: '6g' }, { name: '枳壳', dosage: '6g' }, { name: '甘草', dosage: '6g' }], usage: '水煎服，日1剂', popularity: 84 },
  { id: 12, name: '温胆汤', category: '化痰', indication: '胆郁痰扰', herbs: [{ name: '半夏', dosage: '9g' }, { name: '陈皮', dosage: '9g' }, { name: '茯苓', dosage: '12g' }, { name: '甘草', dosage: '6g' }, { name: '竹茹', dosage: '6g' }, { name: '枳实', dosage: '6g' }], usage: '水煎服，日1剂', popularity: 83 },
  { id: 13, name: '二陈汤', category: '化痰', indication: '湿痰咳嗽', herbs: [{ name: '半夏', dosage: '12g' }, { name: '陈皮', dosage: '9g' }, { name: '茯苓', dosage: '9g' }, { name: '甘草', dosage: '6g' }], usage: '水煎服，日1剂', popularity: 88 },
  { id: 14, name: '参苓白术散', category: '补气', indication: '脾虚湿盛', herbs: [{ name: '人参', dosage: '6g' }, { name: '白术', dosage: '12g' }, { name: '茯苓', dosage: '12g' }, { name: '山药', dosage: '15g' }, { name: '薏苡仁', dosage: '15g' }, { name: '甘草', dosage: '6g' }], usage: '水煎服，日1剂', popularity: 87 },
  { id: 15, name: '桑菊饮', category: '解表', indication: '风热咳嗽', herbs: [{ name: '桑叶', dosage: '9g' }, { name: '菊花', dosage: '9g' }, { name: '杏仁', dosage: '9g' }, { name: '连翘', dosage: '9g' }, { name: '薄荷', dosage: '6g' }, { name: '桔梗', dosage: '6g' }, { name: '甘草', dosage: '3g' }], usage: '水煎服，日1剂', popularity: 86 },
  { id: 16, name: '白虎汤', category: '清热', indication: '气分热盛', herbs: [{ name: '石膏', dosage: '30g' }, { name: '知母', dosage: '12g' }, { name: '甘草', dosage: '6g' }, { name: '粳米', dosage: '9g' }], usage: '水煎服，日1剂', popularity: 82 },
  { id: 17, name: '理中丸', category: '温里', indication: '脾胃虚寒', herbs: [{ name: '人参', dosage: '9g' }, { name: '白术', dosage: '12g' }, { name: '干姜', dosage: '9g' }, { name: '甘草', dosage: '9g' }], usage: '水煎服，日1剂', popularity: 85 },
  { id: 18, name: '八珍汤', category: '气血双补', indication: '气血两虚', herbs: [{ name: '人参', dosage: '6g' }, { name: '白术', dosage: '9g' }, { name: '茯苓', dosage: '9g' }, { name: '甘草', dosage: '6g' }, { name: '当归', dosage: '9g' }, { name: '川芎', dosage: '6g' }, { name: '白芍', dosage: '9g' }, { name: '熟地黄', dosage: '12g' }], usage: '水煎服，日1剂', popularity: 93 },
  { id: 19, name: '独活寄生汤', category: '祛风湿', indication: '痹证日久', herbs: [{ name: '独活', dosage: '9g' }, { name: '桑寄生', dosage: '12g' }, { name: '杜仲', dosage: '12g' }, { name: '牛膝', dosage: '9g' }, { name: '当归', dosage: '9g' }, { name: '川芎', dosage: '6g' }, { name: '甘草', dosage: '6g' }], usage: '水煎服，日1剂', popularity: 81 },
  { id: 20, name: '藿香正气散', category: '化湿', indication: '外感风寒，内伤湿滞', herbs: [{ name: '藿香', dosage: '9g' }, { name: '紫苏', dosage: '6g' }, { name: '白芷', dosage: '6g' }, { name: '半夏', dosage: '9g' }, { name: '陈皮', dosage: '6g' }, { name: '茯苓', dosage: '9g' }, { name: '甘草', dosage: '6g' }], usage: '水煎服，日1剂', popularity: 90 },
  { id: 21, name: '止嗽散', category: '止咳', indication: '风邪犯肺', herbs: [{ name: '桔梗', dosage: '9g' }, { name: '荆芥', dosage: '9g' }, { name: '紫菀', dosage: '9g' }, { name: '百部', dosage: '9g' }, { name: '陈皮', dosage: '6g' }, { name: '甘草', dosage: '6g' }], usage: '水煎服，日1剂', popularity: 84 },
  { id: 22, name: '五苓散', category: '利水', indication: '水湿内停', herbs: [{ name: '茯苓', dosage: '12g' }, { name: '猪苓', dosage: '9g' }, { name: '泽泻', dosage: '12g' }, { name: '白术', dosage: '9g' }, { name: '桂枝', dosage: '6g' }], usage: '水煎服，日1剂', popularity: 83 },
  { id: 23, name: '天王补心丹', category: '安神', indication: '阴虚血少，心神不安', herbs: [{ name: '生地黄', dosage: '12g' }, { name: '麦冬', dosage: '9g' }, { name: '丹参', dosage: '9g' }, { name: '五味子', dosage: '6g' }, { name: '当归', dosage: '9g' }, { name: '甘草', dosage: '6g' }], usage: '水煎服，日1剂', popularity: 80 },
  { id: 24, name: '杏苏散', category: '解表', indication: '凉燥感冒', herbs: [{ name: '杏仁', dosage: '9g' }, { name: '紫苏', dosage: '9g' }, { name: '陈皮', dosage: '6g' }, { name: '半夏', dosage: '9g' }, { name: '茯苓', dosage: '9g' }, { name: '甘草', dosage: '6g' }], usage: '水煎服，日1剂', popularity: 79 },
];

const CATEGORIES = [
  { id: 1, name: '丸剂', count: 8, popularity: '高' },
  { id: 2, name: '合剂', count: 3, popularity: '中' },
  { id: 3, name: '中药材', count: 52, popularity: '高' },
  { id: 4, name: '颗粒剂', count: 4, popularity: '高' },
  { id: 5, name: '片剂', count: 2, popularity: '中' },
  { id: 6, name: '胶囊', count: 1, popularity: '高' },
  { id: 7, name: '补气药', count: 8, popularity: '高' },
  { id: 8, name: '清热药', count: 10, popularity: '高' },
  { id: 9, name: '活血化瘀', count: 6, popularity: '中' },
  { id: 10, name: '解表药', count: 7, popularity: '高' },
];

const RAW_HERB_CATEGORIES = new Set([
  '补气药', '补血药', '活血化瘀', '利水渗湿', '理气药', '化痰止咳',
  '解表药', '温里药', '清热药', '补阳药', '补阴药', '收涩药', '平肝息风', '消食药', '泻下药', '化湿药',
]);

function buildInventoryFromHerbs(herbs) {
  return herbs.map((h) => ({
    id: h.id,
    name: h.name,
    category: h.category,
    stock: h.stock,
    unit: h.unit,
    price: h.price,
    minStock: h.minStock,
    supplier: h.supplier,
    expiryDate: h.expiryDate,
    batchNo: h.batchNo,
    location: h.category.includes('丸') || h.category.includes('颗粒') ? '主库-B区' : '主库-A区',
  }));
}

function getRawHerbNames() {
  return CATALOG_HERBS.filter((h) => RAW_HERB_CATEGORIES.has(h.category)).map((h) => h.name);
}

function ensureCatalogData(store) {
  const existingHerbNames = new Set((store.herbs || []).map((h) => h.name));
  const existingTplNames = new Set((store.prescriptionTemplates || []).map((t) => t.name));

  let herbsAdded = 0;
  let tplAdded = 0;

  store.herbs = store.herbs || [];
  store.inventory = store.inventory || [];
  store.prescriptionTemplates = store.prescriptionTemplates || [];

  const maxHerbId = store.herbs.reduce((m, h) => Math.max(m, h.id), 0);
  let nextHerbId = maxHerbId + 1;

  CATALOG_HERBS.forEach((catalogHerb) => {
    if (!existingHerbNames.has(catalogHerb.name)) {
      const h = { ...catalogHerb, id: nextHerbId };
      store.herbs.push(h);
      store.inventory.push(buildInventoryFromHerbs([h])[0]);
      existingHerbNames.add(h.name);
      nextHerbId += 1;
      herbsAdded += 1;
    }
  });

  const maxTplId = store.prescriptionTemplates.reduce((m, t) => Math.max(m, t.id), 0);
  let nextTplId = maxTplId + 1;

  PRESCRIPTION_TEMPLATES.forEach((tpl) => {
    if (!existingTplNames.has(tpl.name)) {
      store.prescriptionTemplates.push({ ...tpl, id: nextTplId });
      existingTplNames.add(tpl.name);
      nextTplId += 1;
      tplAdded += 1;
    }
  });

  store.categories = CATEGORIES;
  store.nextId = store.nextId || {};
  store.nextId.herb = Math.max(store.nextId.herb || 1, nextHerbId);
  store.nextId.template = Math.max(store.nextId.template || 1, nextTplId);
  store.nextId.inventory = Math.max(store.nextId.inventory || 1, nextHerbId);

  return { herbsAdded, tplAdded, herbTotal: store.herbs.length, templateTotal: store.prescriptionTemplates.length };
}

module.exports = {
  CATALOG_HERBS,
  PRESCRIPTION_TEMPLATES,
  CATEGORIES,
  buildInventoryFromHerbs,
  getRawHerbNames,
  ensureCatalogData,
};
