import React, { useState } from 'react';
import { 
  Box, 
  Typography, 
  Grid, 
  Card, 
  CardContent, 
  CardMedia, 
  Button, 
  Tabs, 
  Tab,
  List, 
  ListItem, 
  ListItemIcon, 
  ListItemText, 
  LinearProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  FormControlLabel,
  Radio,
  RadioGroup,
  Divider,
  Paper,
  Chip,
  IconButton
} from '@mui/material';
import { 
  PlayArrow, 
  Assessment, 
  Bookmark, 
  CheckCircle, 
  OndemandVideo, 
  MenuBook,
  CloudDownload,
  School,
  EmojiEvents,
  Close
} from '@mui/icons-material';

function PharmacistTraining() {
  const [tabValue, setTabValue] = useState(0);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [examOpen, setExamOpen] = useState(false);
  const [certificateOpen, setCertificateOpen] = useState(false);
  const [currentAnswers, setCurrentAnswers] = useState({});
  const [examCompleted, setExamCompleted] = useState(false);
  const [score, setScore] = useState(0);

  // 培训课程数据
  const courses = [
    {
      id: 1,
      title: '中药调剂基础',
      category: '基础课程',
      thumbnail: 'https://source.unsplash.com/random/800x600/?herbs',
      duration: '4小时',
      instructor: '王教授',
      description: '本课程介绍中药调剂的基本原则和方法，包括中药的称量、研磨、混合等操作技术。',
      progress: 0,
      content: [
        { type: '视频', title: '中药调剂概述', duration: '30分钟' },
        { type: '文档', title: '调剂设备与工具', duration: '20分钟' },
        { type: '视频', title: '中药称量技术', duration: '45分钟' },
        { type: '视频', title: '中药研磨与混合', duration: '40分钟' },
        { type: '练习', title: '调剂常见错误分析', duration: '35分钟' },
        { type: '考核', title: '基础知识测试', duration: '30分钟' }
      ],
      exam: {
        title: '中药调剂基础考核',
        questions: [
          {
            id: 1,
            question: '以下哪种称量工具最适合精确称量少量中药?',
            options: ['普通天平', '电子精密天平', '杠杆秤', '台秤'],
            correctAnswer: '电子精密天平'
          },
          {
            id: 2,
            question: '研磨中药材时，以下哪种说法是正确的?',
            options: [
              '所有中药都需要研磨成极细粉',
              '不同中药研磨程度应根据处方要求和药材特性决定',
              '所有中药统一研磨标准',
              '中药不需要研磨'
            ],
            correctAnswer: '不同中药研磨程度应根据处方要求和药材特性决定'
          },
          {
            id: 3,
            question: '调配中药饮片时，以下哪个步骤是错误的?',
            options: [
              '先阅读并理解处方',
              '准备好所需饮片',
              '先加水后加药材',
              '按处方核对饮片种类和数量'
            ],
            correctAnswer: '先加水后加药材'
          },
          {
            id: 4,
            question: '中药称量允许的误差范围一般是多少?',
            options: ['±10%', '±5%', '±2%', '不允许有误差'],
            correctAnswer: '±5%'
          },
          {
            id: 5,
            question: '下列哪种中药饮片一般不宜与其他药材一起研磨?',
            options: ['人参', '三七', '朱砂', '黄芪'],
            correctAnswer: '朱砂'
          }
        ]
      }
    },
    {
      id: 2,
      title: '常用中药鉴别方法',
      category: '专业技能',
      thumbnail: 'https://source.unsplash.com/random/800x600/?medicine',
      duration: '6小时',
      instructor: '李主任',
      description: '学习常用中药的鉴别方法，包括性状鉴别、显微鉴别和理化鉴别等技术，提高药师对中药材真伪优劣的鉴别能力。',
      progress: 30,
      content: [
        { type: '视频', title: '中药鉴别概述', duration: '40分钟' },
        { type: '视频', title: '性状鉴别方法', duration: '60分钟' },
        { type: '文档', title: '显微鉴别技术', duration: '45分钟' },
        { type: '视频', title: '理化鉴别实例', duration: '50分钟' },
        { type: '练习', title: '常见中药材鉴别练习', duration: '60分钟' },
        { type: '考核', title: '鉴别技能测试', duration: '45分钟' }
      ]
    },
    {
      id: 3,
      title: '中药不良反应与安全用药',
      category: '安全用药',
      thumbnail: 'https://source.unsplash.com/random/800x600/?safety',
      duration: '5小时',
      instructor: '张医师',
      description: '本课程详细介绍中药常见不良反应、毒性反应的识别、预防和处理，以及安全用药的原则和注意事项。',
      progress: 75,
      content: [
        { type: '视频', title: '中药不良反应概述', duration: '35分钟' },
        { type: '文档', title: '常见中药毒性分析', duration: '50分钟' },
        { type: '视频', title: '特殊人群用药注意事项', duration: '55分钟' },
        { type: '视频', title: '中药与西药相互作用', duration: '45分钟' },
        { type: '练习', title: '案例分析', duration: '40分钟' },
        { type: '考核', title: '安全知识测评', duration: '35分钟' }
      ]
    },
    {
      id: 4,
      title: '中药饮片炮制技术',
      category: '专业技能',
      thumbnail: 'https://source.unsplash.com/random/800x600/?herbalmedicine',
      duration: '8小时',
      instructor: '刘教授',
      description: '深入学习中药饮片炮制的理论基础、操作技术和质量控制，掌握常用中药饮片的炮制方法和要点。',
      progress: 10,
      content: [
        { type: '视频', title: '炮制理论基础', duration: '40分钟' },
        { type: '视频', title: '常用炮制方法', duration: '90分钟' },
        { type: '文档', title: '炮制设备与工具', duration: '30分钟' },
        { type: '视频', title: '典型药材炮制演示', duration: '120分钟' },
        { type: '练习', title: '炮制工艺分析', duration: '60分钟' },
        { type: '考核', title: '炮制技术评估', duration: '50分钟' }
      ]
    },
    {
      id: 5,
      title: '中药处方审核规范',
      category: '合规管理',
      thumbnail: 'https://source.unsplash.com/random/800x600/?prescription',
      duration: '3小时',
      instructor: '陈药师',
      description: '学习中药处方审核的专业知识和技能，包括处方合法性、规范性、适宜性和安全性的审核要点与方法。',
      progress: 100,
      content: [
        { type: '视频', title: '处方审核概述', duration: '30分钟' },
        { type: '文档', title: '处方合法性审核', duration: '35分钟' },
        { type: '视频', title: '处方适宜性评估', duration: '45分钟' },
        { type: '视频', title: '处方安全性审核', duration: '40分钟' },
        { type: '练习', title: '处方审核案例分析', duration: '30分钟' },
        { type: '考核', title: '审核能力测试', duration: '20分钟' }
      ]
    },
    {
      id: 6,
      title: '中药临床应用新进展',
      category: '继续教育',
      thumbnail: 'https://source.unsplash.com/random/800x600/?clinical',
      duration: '4小时',
      instructor: '赵教授',
      description: '介绍中药在临床应用的最新研究进展和趋势，包括新适应症、新剂型、新配伍等内容。',
      progress: 50,
      content: [
        { type: '视频', title: '中药研究新趋势', duration: '45分钟' },
        { type: '文档', title: '中药新剂型介绍', duration: '30分钟' },
        { type: '视频', title: '中药新适应症研究', duration: '50分钟' },
        { type: '视频', title: '经典名方新用途', duration: '40分钟' },
        { type: '练习', title: '研究前沿讨论', duration: '35分钟' },
        { type: '考核', title: '新知识测评', duration: '30分钟' }
      ]
    }
  ];

  // 分类课程数据
  const coursesByCategory = {
    '全部课程': courses,
    '基础课程': courses.filter(course => course.category === '基础课程'),
    '专业技能': courses.filter(course => course.category === '专业技能'),
    '安全用药': courses.filter(course => course.category === '安全用药'),
    '合规管理': courses.filter(course => course.category === '合规管理'),
    '继续教育': courses.filter(course => course.category === '继续教育')
  };

  // Tab切换处理
  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  // 打开课程
  const handleOpenCourse = (course) => {
    setSelectedCourse(course);
  };

  // 关闭课程
  const handleCloseCourse = () => {
    setSelectedCourse(null);
  };

  // 打开考试
  const handleOpenExam = () => {
    setExamOpen(true);
    setCurrentAnswers({});
    setExamCompleted(false);
  };

  // 关闭考试
  const handleCloseExam = () => {
    setExamOpen(false);
  };

  // 处理答题
  const handleAnswerChange = (questionId, answer) => {
    setCurrentAnswers({
      ...currentAnswers,
      [questionId]: answer
    });
  };

  // 提交考试
  const handleSubmitExam = () => {
    // 计算得分
    const questions = selectedCourse.exam.questions;
    let correctCount = 0;
    
    questions.forEach(question => {
      if (currentAnswers[question.id] === question.correctAnswer) {
        correctCount++;
      }
    });
    
    const calculatedScore = Math.round((correctCount / questions.length) * 100);
    setScore(calculatedScore);
    setExamCompleted(true);
    
    // 如果分数大于等于60，显示证书
    if (calculatedScore >= 60) {
      setTimeout(() => {
        setExamOpen(false);
        setCertificateOpen(true);
      }, 2000);
    }
  };

  // 关闭证书
  const handleCloseCertificate = () => {
    setCertificateOpen(false);
  };

  // 渲染课程列表
  const renderCourseList = () => {
    const categories = Object.keys(coursesByCategory);
    
    return (
      <Box sx={{ width: '100%' }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
          <Tabs 
            value={tabValue} 
            onChange={handleTabChange} 
            variant="scrollable"
            scrollButtons="auto"
          >
            {categories.map((category, index) => (
              <Tab key={index} label={category} />
            ))}
          </Tabs>
        </Box>
        
        <Grid container spacing={3}>
          {coursesByCategory[categories[tabValue]].map((course) => (
            <Grid item xs={12} sm={6} md={4} key={course.id}>
              <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                <CardMedia
                  component="img"
                  height="140"
                  image={course.thumbnail}
                  alt={course.title}
                />
                <CardContent sx={{ flexGrow: 1 }}>
                  <Typography variant="h6" component="div" gutterBottom>
                    {course.title}
                  </Typography>
                  <Chip 
                    label={course.category} 
                    size="small" 
                    color="primary" 
                    sx={{ mb: 1 }} 
                  />
                  <Typography variant="body2" color="text.secondary" paragraph>
                    {course.description}
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <School fontSize="small" color="action" sx={{ mr: 1 }} />
                    <Typography variant="body2" color="text.secondary">
                      讲师: {course.instructor}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <OndemandVideo fontSize="small" color="action" sx={{ mr: 1 }} />
                    <Typography variant="body2" color="text.secondary">
                      {course.duration}
                    </Typography>
                  </Box>
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      学习进度: {course.progress}%
                    </Typography>
                    <LinearProgress 
                      variant="determinate" 
                      value={course.progress} 
                      sx={{ height: 6, borderRadius: 3 }}
                    />
                  </Box>
                </CardContent>
                <Box sx={{ p: 2, pt: 0 }}>
                  <Button 
                    variant="contained" 
                    color="primary" 
                    fullWidth
                    startIcon={<PlayArrow />}
                    onClick={() => handleOpenCourse(course)}
                  >
                    {course.progress > 0 ? "继续学习" : "开始学习"}
                  </Button>
                </Box>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Box>
    );
  };

  // 渲染课程详情
  const renderCourseDetail = () => {
    if (!selectedCourse) return null;
    
    return (
      <Box sx={{ position: 'relative' }}>
        <IconButton 
          sx={{ position: 'absolute', top: 10, right: 10, bgcolor: 'rgba(255,255,255,0.7)' }}
          onClick={handleCloseCourse}
        >
          <Close />
        </IconButton>
        
        <Grid container spacing={3}>
          <Grid item xs={12} md={8}>
            <Card>
              <CardMedia
                component="img"
                height="300"
                image={selectedCourse.thumbnail}
                alt={selectedCourse.title}
                sx={{ objectFit: 'cover' }}
              />
              <CardContent>
                <Typography variant="h5" gutterBottom>
                  {selectedCourse.title}
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 2, mb: 2 }}>
                  <Chip 
                    label={selectedCourse.category} 
                    color="primary" 
                    size="small" 
                  />
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <School fontSize="small" sx={{ mr: 0.5 }} />
                    <Typography variant="body2">
                      {selectedCourse.instructor}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <OndemandVideo fontSize="small" sx={{ mr: 0.5 }} />
                    <Typography variant="body2">
                      {selectedCourse.duration}
                    </Typography>
                  </Box>
                </Box>
                <Typography variant="body1" paragraph>
                  {selectedCourse.description}
                </Typography>
                
                <Box sx={{ my: 3 }}>
                  <Typography variant="h6" gutterBottom>
                    课程内容
                  </Typography>
                  <List>
                    {selectedCourse.content.map((item, index) => (
                      <Paper key={index} elevation={1} sx={{ mb: 2, p: 1 }}>
                        <ListItem>
                          <ListItemIcon>
                            {item.type === '视频' ? <OndemandVideo color="primary" /> :
                             item.type === '文档' ? <MenuBook color="secondary" /> :
                             item.type === '练习' ? <Assessment color="success" /> :
                             <EmojiEvents color="warning" />}
                          </ListItemIcon>
                          <ListItemText 
                            primary={`${index + 1}. ${item.title}`}
                            secondary={`${item.type} · ${item.duration}`}
                          />
                          <Button 
                            variant="outlined" 
                            size="small"
                            startIcon={item.type === '考核' ? <Assessment /> : <PlayArrow />}
                            color={item.type === '考核' ? "warning" : "primary"}
                            onClick={item.type === '考核' ? handleOpenExam : undefined}
                          >
                            {item.type === '考核' ? "参加考核" : "学习"}
                          </Button>
                        </ListItem>
                      </Paper>
                    ))}
                  </List>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12} md={4}>
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  学习进度
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <Box sx={{ width: '100%', mr: 1 }}>
                    <LinearProgress 
                      variant="determinate" 
                      value={selectedCourse.progress} 
                      sx={{ height: 10, borderRadius: 5 }}
                    />
                  </Box>
                  <Typography variant="body2" color="text.secondary">
                    {selectedCourse.progress}%
                  </Typography>
                </Box>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                  {selectedCourse.progress === 100 
                    ? "恭喜您已完成本课程学习!" 
                    : "继续加油，完成剩余内容"}
                </Typography>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  学习资料
                </Typography>
                <List>
                  <ListItem sx={{ pl: 0 }}>
                    <ListItemIcon>
                      <CloudDownload />
                    </ListItemIcon>
                    <ListItemText primary="课程讲义.pdf" />
                    <Button size="small">下载</Button>
                  </ListItem>
                  <Divider />
                  <ListItem sx={{ pl: 0 }}>
                    <ListItemIcon>
                      <CloudDownload />
                    </ListItemIcon>
                    <ListItemText primary="实验指南.pdf" />
                    <Button size="small">下载</Button>
                  </ListItem>
                  <Divider />
                  <ListItem sx={{ pl: 0 }}>
                    <ListItemIcon>
                      <CloudDownload />
                    </ListItemIcon>
                    <ListItemText primary="参考文献清单.pdf" />
                    <Button size="small">下载</Button>
                  </ListItem>
                </List>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Box>
    );
  };

  // 渲染考试对话框
  const renderExamDialog = () => {
    if (!selectedCourse || !selectedCourse.exam) return null;
    
    const { exam } = selectedCourse;
    const questions = exam.questions;
    
    return (
      <Dialog 
        open={examOpen} 
        onClose={examCompleted ? handleCloseExam : undefined}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {exam.title}
          {!examCompleted && (
            <IconButton
              aria-label="close"
              onClick={handleCloseExam}
              sx={{
                position: 'absolute',
                right: 8,
                top: 8
              }}
            >
              <Close />
            </IconButton>
          )}
        </DialogTitle>
        <DialogContent dividers>
          {examCompleted ? (
            <Box sx={{ textAlign: 'center', py: 3 }}>
              <Typography variant="h5" gutterBottom>
                考核完成
              </Typography>
              <Typography variant="h3" color={score >= 60 ? "success.main" : "error.main"} gutterBottom>
                {score}分
              </Typography>
              <Typography variant="body1" gutterBottom>
                {score >= 60 
                  ? "恭喜你通过了考核!" 
                  : "很遗憾，未达到通过分数，请重新学习后再尝试。"}
              </Typography>
              <LinearProgress 
                variant="determinate" 
                value={score} 
                sx={{ 
                  height: 10, 
                  borderRadius: 5, 
                  mt: 2, 
                  mb: 4,
                  backgroundColor: 'error.light',
                  '& .MuiLinearProgress-bar': {
                    backgroundColor: score >= 60 ? 'success.main' : 'error.main'
                  }
                }}
              />
            </Box>
          ) : (
            <Box>
              {questions.map((question, index) => (
                <Box key={question.id} sx={{ mb: 4 }}>
                  <Typography variant="h6" gutterBottom>
                    {index + 1}. {question.question}
                  </Typography>
                  <FormControl component="fieldset" sx={{ ml: 2 }}>
                    <RadioGroup
                      value={currentAnswers[question.id] || ''}
                      onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                    >
                      {question.options.map((option, optionIndex) => (
                        <FormControlLabel
                          key={optionIndex}
                          value={option}
                          control={<Radio />}
                          label={option}
                        />
                      ))}
                    </RadioGroup>
                  </FormControl>
                </Box>
              ))}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          {examCompleted ? (
            <Button onClick={handleCloseExam} variant="contained">
              {score >= 60 ? "获取证书" : "关闭"}
            </Button>
          ) : (
            <Button 
              onClick={handleSubmitExam} 
              variant="contained" 
              color="primary"
              disabled={Object.keys(currentAnswers).length !== questions.length}
            >
              提交答案
            </Button>
          )}
        </DialogActions>
      </Dialog>
    );
  };

  // 渲染证书对话框
  const renderCertificateDialog = () => {
    if (!selectedCourse) return null;
    
    const currentDate = new Date();
    const formattedDate = `${currentDate.getFullYear()}年${currentDate.getMonth() + 1}月${currentDate.getDate()}日`;
    
    return (
      <Dialog 
        open={certificateOpen} 
        onClose={handleCloseCertificate}
        maxWidth="md"
        fullWidth
      >
        <DialogContent>
          <Box 
            sx={{ 
              border: '10px solid #f5f5f5', 
              p: 4, 
              textAlign: 'center',
              backgroundImage: 'linear-gradient(to bottom right, #f9f9f9, #ffffff)',
              position: 'relative',
              overflow: 'hidden'
            }}
          >
            <Box 
              sx={{ 
                position: 'absolute', 
                top: '50%', 
                left: '50%', 
                transform: 'translate(-50%, -50%) rotate(-45deg)',
                opacity: 0.03,
                fontSize: '150px',
                width: '100%'
              }}
            >
              中药药房
            </Box>
            <Typography variant="h4" color="primary" gutterBottom>
              结业证书
            </Typography>
            <Typography variant="h6" gutterBottom sx={{ mt: 4 }}>
              兹证明
            </Typography>
            <Typography variant="h5" gutterBottom sx={{ fontWeight: 'bold', my: 3 }}>
              药师
            </Typography>
            <Typography variant="body1" paragraph sx={{ mb: 4 }}>
              已完成《{selectedCourse.title}》培训课程的全部学习内容，
              并通过了考核，特发此证。
            </Typography>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 6 }}>
              <Typography variant="body2">
                成绩: {score}分
              </Typography>
              <Typography variant="body2">
                日期: {formattedDate}
              </Typography>
            </Box>
            <Box sx={{ mt: 4, display: 'flex', justifyContent: 'center' }}>
              <EmojiEvents color="primary" sx={{ fontSize: 40 }} />
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseCertificate}>关闭</Button>
          <Button variant="contained" color="primary" startIcon={<CloudDownload />}>
            下载证书
          </Button>
        </DialogActions>
      </Dialog>
    );
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>药师培训</Typography>
      
      {!selectedCourse ? (
        renderCourseList()
      ) : (
        renderCourseDetail()
      )}
      
      {renderExamDialog()}
      {renderCertificateDialog()}
    </Box>
  );
}

export default PharmacistTraining; 