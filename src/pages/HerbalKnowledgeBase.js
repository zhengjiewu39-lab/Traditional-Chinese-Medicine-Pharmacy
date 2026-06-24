import React, { useState } from 'react';
import { 
  Box, 
  Typography, 
  Grid, 
  Card, 
  CardContent, 
  TextField, 
  InputAdornment,
  IconButton,
  Chip
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';

function HerbalKnowledgeBase() {
  const [searchTerm, setSearchTerm] = useState('');
  
  // 中药数据库
  const herbs = [
    { 
      name: '人参', 
      pinyin: 'Renshen',
      properties: '甘、微苦，微温',
      meridians: '脾、肺、心、肾经',
      functions: '大补元气，复脉固脱，补脾益肺，生津，安神。用于体虚欲脱，肢冷脉微，脾虚食少，肺虚喘咳，津伤口渴，内热消渴，久病虚羸，惊悸失眠，心力衰竭等。'
    },
    { 
      name: '黄芪', 
      pinyin: 'Huangqi',
      properties: '甘，微温',
      meridians: '脾、肺经',
      functions: '补气固表，利水消肿，托毒排脓，生肌。用于气虚乏力，食少便溏，中气下陷，久泻脱肛，自汗，气虚水肿，痈疽难溃，久溃不敛等。'
    },
    { 
      name: '白术', 
      pinyin: 'Baizhu',
      properties: '苦、甘，温',
      meridians: '脾、胃经',
      functions: '健脾益气，燥湿利水，止汗，安胎。用于脾虚食少，腹胀泄泻，痰饮眩悸，水肿，自汗，胎动不安等。'
    },
    { 
      name: '茯苓', 
      pinyin: 'Fuling',
      properties: '甘、淡，平',
      meridians: '心、肺、脾、肾经',
      functions: '利水渗湿，健脾，宁心。用于水肿尿少，痰饮，心悸不宁，失眠健忘，脾虚食少，便溏等。'
    },
    { 
      name: '当归', 
      pinyin: 'Danggui',
      properties: '甘、辛，温',
      meridians: '肝、心、脾经',
      functions: '补血活血，调经止痛，润肠通便。用于血虚萎黄，眩晕心悸，月经不调，经闭痛经，虚寒腹痛，肠燥便秘，风湿痹痛，跌扑损伤，痈疽疮疡等。'
    },
    { 
      name: '川芎', 
      pinyin: 'Chuanxiong',
      properties: '辛，温',
      meridians: '肝、胆、心包经',
      functions: '活血行气，祛风止痛。用于月经不调，经闭痛经，胸胁刺痛，跌打损伤，头痛，风湿痹痛。'
    },
    { 
      name: '熟地黄', 
      pinyin: 'Shudihuang',
      properties: '甘，微温',
      meridians: '肝、肾经',
      functions: '滋阴补血，益精填髓。用于血虚萎黄，眩晕心悸，月经不调，肾阴亏虚，腰膝酸软，遗精，消渴，内热消渴。'
    },
    { 
      name: '白芍', 
      pinyin: 'Baishao',
      properties: '苦、酸，微寒',
      meridians: '肝、脾经',
      functions: '养血调经，敛阴止汗，柔肝止痛，平抑肝阳。用于血虚萎黄，月经不调，自汗，腹痛，四肢挛痛，头痛眩晕。'
    },
    { 
      name: '甘草', 
      pinyin: 'Gancao',
      properties: '甘，平',
      meridians: '心、肺、脾、胃经',
      functions: '补脾益气，清热解毒，祛痰止咳，缓急止痛，调和诸药。用于脾胃虚弱，倦怠乏力，心悸气短，咳嗽痰多，脘腹、四肢挛急疼痛，缓解药物毒性。'
    },
    { 
      name: '黄连', 
      pinyin: 'Huanglian',
      properties: '苦，寒',
      meridians: '心、肝、胃、大肠经',
      functions: '清热燥湿，泻火解毒。用于湿热痞满，呕吐，泻痢，黄疸，高热神昏，心火亢盛，心烦不寐，血热吐衄，目赤，牙痛，消渴，疮疡肿毒。'
    },
    { 
      name: '黄芩', 
      pinyin: 'Huangqin',
      properties: '苦，寒',
      meridians: '肺、胆、肝、大肠经',
      functions: '清热燥湿，泻火解毒，止血，安胎。用于肺热咳嗽，热病高热，湿热黄疸，泻痢，吐血衄血，胎动不安等。'
    },
    { 
      name: '板蓝根', 
      pinyin: 'Banlangen',
      properties: '苦，寒',
      meridians: '心、肺、胃经',
      functions: '清热解毒，凉血利咽。用于温热病发热，咽喉肿痛，大头瘟疫，丹毒，痄腮，疮疡肿毒，热毒血痢等。'
    },
    { 
      name: '金银花', 
      pinyin: 'Jinyinhua',
      properties: '甘，寒',
      meridians: '肺、心、胃经',
      functions: '清热解毒，疏散风热。用于痈肿疔疮，喉痹，丹毒，热毒血痢，风热感冒，温病发热等。'
    },
    { 
      name: '连翘', 
      pinyin: 'Lianqiao',
      properties: '苦，微寒',
      meridians: '心、肺、小肠经',
      functions: '清热解毒，消肿散结，疏散风热。用于痈肿疔疮，瘰疬，乳痈，丹毒，热毒发斑，风热感冒，温病初起等。'
    },
    { 
      name: '柴胡', 
      pinyin: 'Chaihu',
      properties: '苦，微寒',
      meridians: '肝、胆经',
      functions: '疏肝解郁，升阳举陷，退热。用于感冒发热，寒热往来，胸胁胀痛，月经不调，气滞血瘀，脱肛，子宫脱垂等。'
    },
    { 
      name: '党参', 
      pinyin: 'Dangshen',
      properties: '甘，平',
      meridians: '脾、肺经',
      functions: '补中益气，健脾益肺。用于脾肺虚弱，气短心悸，食少倦怠，咳嗽虚喘，内热消渴。'
    },
    { 
      name: '丹参', 
      pinyin: 'Danshen',
      properties: '苦，微寒',
      meridians: '心、肝、心包经',
      functions: '活血祛瘀，通经止痛，清心除烦，凉血消痈。用于胸痹心痛，心烦不眠，月经不调，痛经经闭，症瘕积聚，疮疡肿痛等。'
    },
    { 
      name: '红花', 
      pinyin: 'Honghua',
      properties: '辛，温',
      meridians: '心、肝经',
      functions: '活血通经，散瘀止痛。用于经闭，痛经，恶露不行，症瘕结块，胸痹心痛，跌扑损伤，疮疡肿痛等。'
    },
    { 
      name: '桂枝', 
      pinyin: 'Guizhi',
      properties: '辛、甘，温',
      meridians: '心、肺、膀胱经',
      functions: '发汗解表，温通经脉，助阳化气，平冲降逆。用于风寒感冒，体虚自汗，阳虚肢冷，痰饮，胸痹，历节风痛等。'
    },
    { 
      name: '麻黄', 
      pinyin: 'Mahuang',
      properties: '辛、微苦，温',
      meridians: '肺、膀胱经',
      functions: '发汗解表，宣肺平喘，利水消肿。用于风寒感冒，恶寒发热，头痛身痛，无汗而喘，风水浮肿等。'
    },
    { 
      name: '防风', 
      pinyin: 'Fangfeng',
      properties: '辛、甘，微温',
      meridians: '膀胱、肝、脾经',
      functions: '祛风解表，胜湿止痛，解痉。用于风寒感冒，头痛，风湿痹痛，痉挛抽搐等。'
    },
    { 
      name: '薄荷', 
      pinyin: 'Bohe',
      properties: '辛，凉',
      meridians: '肺、肝经',
      functions: '疏散风热，清利头目，利咽透疹，疏肝行气。用于风热感冒，头痛目赤，咽喉肿痛，风疹瘙痒，肝郁气滞等。'
    },
    { 
      name: '葛根', 
      pinyin: 'Gegen',
      properties: '甘、辛，凉',
      meridians: '脾、胃经',
      functions: '解肌退热，生津止渴，升阳止泻，通经活络。用于外感发热头痛，项背强痛，口渴，消渴，泄泻，痢疾，麻疹不透，中风偏瘫等。'
    },
    { 
      name: '牛膝', 
      pinyin: 'Niuxi',
      properties: '苦、酸，平',
      meridians: '肝、肾经',
      functions: '活血散瘀，补肝肾，强筋骨，通经络，引血下行。用于腰膝酸痛，筋骨痿软，经闭，尿血，吐血，跌打损伤，高血压等。'
    },
    { 
      name: '山药', 
      pinyin: 'Shanyao',
      properties: '甘，平',
      meridians: '脾、肺、肾经',
      functions: '补脾养胃，生津益肺，补肾涩精。用于脾虚食少，久泻不止，肺虚喘咳，肾虚遗精，带下，尿频，虚热消渴等。'
    },
    { 
      name: '山楂', 
      pinyin: 'Shanzha',
      properties: '酸、甘，微温',
      meridians: '脾、胃、肝经',
      functions: '消食化积，行气散瘀，活血化浊。用于肉食积滞，胃脘胀满，泻痢，瘀血经闭，产后瘀阻，高脂血症等。'
    },
    { 
      name: '菊花', 
      pinyin: 'Juhua',
      properties: '甘、苦，凉',
      meridians: '肺、肝经',
      functions: '疏风清热，平肝明目，清热解毒。用于风热感冒，头痛眩晕，目赤肿痛，目暗昏花，皮肤疮疡等。'
    },
    { 
      name: '枸杞子', 
      pinyin: 'Gouqizi',
      properties: '甘，平',
      meridians: '肝、肾、肺经',
      functions: '滋补肝肾，益精明目，养血。用于肝肾阴虚，腰膝酸软，眩晕耳鸣，视物模糊，内热消渴，血虚萎黄等。'
    },
    { 
      name: '大枣', 
      pinyin: 'Dazao',
      properties: '甘，温',
      meridians: '脾、胃经',
      functions: '补中益气，养血安神，调和药性。用于脾胃虚弱，食少乏力，血虚萎黄，心悸失眠，脾弱泄泻等。'
    },
    { 
      name: '酸枣仁', 
      pinyin: 'Suanzaoren',
      properties: '甘、酸，平',
      meridians: '心、肝、胆经',
      functions: '养心安神，敛汗，生津。用于虚烦不眠，惊悸多梦，体虚多汗，津伤口渴等。'
    },
    { 
      name: '莲子', 
      pinyin: 'Lianzi',
      properties: '甘、涩，平',
      meridians: '心、脾、肾经',
      functions: '补脾止泻，益肾涩精，养心安神。用于脾虚久泻，食少便溏，肾虚遗精，白浊，心悸失眠，热病后期心烦等。'
    },
    { 
      name: '石斛', 
      pinyin: 'Shihu',
      properties: '甘，微寒',
      meridians: '胃、肾经',
      functions: '养阴生津，清热明目。用于热病津伤，口干烦渴，胃阴不足，食少干呕，肾阴亏虚，目疾等。'
    },
    { 
      name: '玉竹', 
      pinyin: 'Yuzhu',
      properties: '甘，微寒',
      meridians: '肺、胃经',
      functions: '养阴润肺，生津止渴。用于肺燥干咳，阴虚内热，虚烦口渴，便秘等。'
    },
    { 
      name: '百合', 
      pinyin: 'Baihe',
      properties: '甘，微寒',
      meridians: '心、肺经',
      functions: '养阴润肺，清心安神。用于肺燥干咳，阴虚劳嗽，痰中带血，虚烦惊悸，失眠，精神恍惚等。'
    },
    { 
      name: '天冬', 
      pinyin: 'Tiandong',
      properties: '甘、苦，寒',
      meridians: '肺、肾经',
      functions: '养阴润肺，生津清热。用于肺热燥咳，阴虚劳嗽，咽干口渴，内热消渴等。'
    },
    { 
      name: '麦冬', 
      pinyin: 'Maidong',
      properties: '甘、微苦，微寒',
      meridians: '心、肺、胃经',
      functions: '养阴生津，润肺清心。用于热病津伤，口干烦渴，肺热干咳，阴虚痨嗽，心烦失眠，肠燥便秘等。'
    },
    { 
      name: '沙参', 
      pinyin: 'Shashen',
      properties: '甘、微苦，微寒',
      meridians: '肺、胃经',
      functions: '养阴清肺，益胃生津。用于肺热燥咳，阴虚劳嗽，热病伤津，口干烦渴，胃阴不足，食少干呕等。'
    },
    { 
      name: '桑叶', 
      pinyin: 'Sangye',
      properties: '苦、甘，寒',
      meridians: '肺、肝经',
      functions: '疏散风热，清肺润燥，平肝明目，凉血。用于风热感冒，肺热咳嗽，肝阳上亢，头晕目眩，目赤昏花等。'
    },
    { 
      name: '菟丝子', 
      pinyin: 'Tusizi',
      properties: '辛、甘，平',
      meridians: '肝、肾、脾经',
      functions: '补肾益精，养肝明目，固精缩尿，安胎。用于肾虚腰痛，阳痿遗精，遗尿尿频，目昏耳鸣，肝肾不足，崩漏带下，胎动不安等。'
    },
    { 
      name: '肉苁蓉', 
      pinyin: 'Roucongrong',
      properties: '甘，温',
      meridians: '肾、大肠经',
      functions: '补肾阳，益精血，润肠通便。用于阳痿不育，腰膝酸冷，筋骨痿软，肠燥便秘等。'
    },
    { 
      name: '巴戟天', 
      pinyin: 'Bajitian',
      properties: '辛、甘，微温',
      meridians: '肾、肝经',
      functions: '补肾阳，强筋骨，祛风湿。用于阳痿遗精，宫冷不孕，腰膝冷痛，筋骨痿软，风湿痹痛等。'
    },
    { 
      name: '淫羊藿', 
      pinyin: 'Yinyanghuo',
      properties: '辛、甘，温',
      meridians: '肝、肾经',
      functions: '补肾壮阳，祛风除湿，强筋骨。用于阳痿遗精，腰膝冷痛，风湿痹痛，半身不遂，筋骨痿软等。'
    },
    { 
      name: '覆盆子', 
      pinyin: 'Fupenzi',
      properties: '甘、酸，平',
      meridians: '肝、肾经',
      functions: '补肾固精，缩尿止带，明目。用于遗精滑精，遗尿尿频，崩漏带下，目昏多泪等。'
    },
    { 
      name: '桑寄生', 
      pinyin: 'Sangjisheng',
      properties: '苦、甘，平',
      meridians: '肝、肾经',
      functions: '补肝肾，强筋骨，祛风湿，安胎。用于肝肾不足，腰膝酸软，风湿痹痛，筋骨痿弱，胎漏胎动等。'
    },
    { 
      name: '杜仲', 
      pinyin: 'Duzhong',
      properties: '甘，温',
      meridians: '肝、肾经',
      functions: '补肝肾，强筋骨，安胎。用于肝肾不足，腰膝酸痛，筋骨无力，小便频数，阳痿遗精，高血压，胎漏胎动等。'
    },
    { 
      name: '川牛膝', 
      pinyin: 'Chuanniuxi',
      properties: '苦、酸，平',
      meridians: '肝、肾经',
      functions: '活血散瘀，补肝肾，强筋骨，通经络，引血下行。用于腰膝酸痛，筋骨痿软，经闭，尿血，吐血，跌打损伤，高血压等。'
    },
    { 
      name: '黄精', 
      pinyin: 'Huangjing',
      properties: '甘，平',
      meridians: '脾、肺、肾经',
      functions: '补气养阴，健脾，润肺，益肾。用于脾胃虚弱，食少乏力，肺虚咳嗽，消渴，肾虚腰痛等。'
    },
    { 
      name: '五味子', 
      pinyin: 'Wuweizi',
      properties: '酸、甘，温',
      meridians: '肺、心、肾经',
      functions: '收敛固涩，益气生津，补肾宁心。用于久嗽虚喘，自汗盗汗，遗精滑精，久泻不止，心悸失眠等。'
    },
    { 
      name: '远志', 
      pinyin: 'Yuanzhi',
      properties: '苦、辛，微温',
      meridians: '心、肾、肺经',
      functions: '安神益智，祛痰开窍，消肿散结。用于心悸失眠，健忘惊悸，神志恍惚，咳痰不爽，乳腺炎，瘰疬痰核等。'
    },
    { 
      name: '女贞子', 
      pinyin: 'Nvzhenzi',
      properties: '甘、苦，凉',
      meridians: '肝、肾经',
      functions: '滋补肝肾，明目乌发。用于肝肾阴虚，腰膝酸软，头晕目眩，须发早白等。'
    }
  ];

  // 过滤搜索结果
  const filteredHerbs = herbs.filter(herb => 
    herb.name.includes(searchTerm) || 
    herb.pinyin.toLowerCase().includes(searchTerm.toLowerCase()) ||
    herb.functions.includes(searchTerm)
  );

  return (
    <Box sx={{ padding: 3 }}>
      <Typography variant="h4" gutterBottom>中药知识库</Typography>
      
      <TextField
        fullWidth
        variant="outlined"
        placeholder="搜索中药名称、拼音或功效..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        sx={{ mb: 4 }}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon />
            </InputAdornment>
          ),
        }}
      />

      <Grid container spacing={3}>
        {filteredHerbs.map((herb, index) => (
          <Grid item xs={12} sm={6} md={4} key={index}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Typography variant="h6" component="div" gutterBottom>
                  {herb.name} <Typography variant="body2" component="span" color="text.secondary">({herb.pinyin})</Typography>
                </Typography>
                
                <Box sx={{ mb: 1 }}>
                  <Chip label={`性味：${herb.properties}`} size="small" sx={{ mr: 1, mb: 1 }} />
                  <Chip label={`归经：${herb.meridians}`} size="small" sx={{ mb: 1 }} />
                </Box>
                
                <Typography variant="body2" color="text.secondary">
                  <strong>功效与应用：</strong> {herb.functions}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}

export default HerbalKnowledgeBase; 