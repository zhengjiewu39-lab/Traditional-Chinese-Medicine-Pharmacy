import React, { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  IconButton,
  Card,
  CardContent,
  CardHeader,
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Divider,
  Tooltip,
  CircularProgress,
  Alert,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Tabs,
  Tab,
  LinearProgress,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Info as InfoIcon,
  PersonAdd as PersonAddIcon,
  SmartToy as AIIcon,
  MonetizationOn as CostIcon,
  Speed as EfficiencyIcon,
  Lightbulb as InsightIcon,
  TrendingUp as OptimizeIcon,
} from '@mui/icons-material';
import { Tree, TreeNode } from 'react-organizational-chart';

const initialDepartments = [
  {
    id: '1',
    name: '总部',
    manager: '张三',
    employeeCount: 50,
    description: '总部负责全国连锁药房的管理和战略规划',
    location: '北京市朝阳区',
    foundedDate: '2010-01-15',
    children: [
      {
        id: '2',
        name: '采购部',
        manager: '李四',
        employeeCount: 15,
        description: '负责中药材和药品的采购与供应链管理',
        location: '北京市朝阳区',
        foundedDate: '2010-03-20',
      },
      {
        id: '3',
        name: '销售部',
        manager: '王五',
        employeeCount: 20,
        description: '负责全国药房的销售策略和营销活动',
        location: '北京市朝阳区',
        foundedDate: '2010-02-18',
      },
      {
        id: '4',
        name: '质量部',
        manager: '赵六',
        employeeCount: 10,
        description: '负责药品质量控制和检测',
        location: '北京市朝阳区',
        foundedDate: '2010-05-12',
      },
    ],
  },
  {
    id: '5',
    name: '北京分部',
    manager: '刘一',
    employeeCount: 30,
    description: '管理北京地区的连锁药房运营',
    location: '北京市海淀区',
    foundedDate: '2011-06-22',
    children: [
      {
        id: '6',
        name: '零售药房',
        manager: '陈二',
        employeeCount: 10,
        description: '北京地区线下药房的日常运营',
        location: '北京市海淀区',
        foundedDate: '2011-08-15',
      },
      {
        id: '7',
        name: '品控部门',
        manager: '张五',
        employeeCount: 5,
        description: '负责北京地区药品质量控制',
        location: '北京市海淀区',
        foundedDate: '2011-09-05',
      },
    ],
  },
  {
    id: '8',
    name: '上海分部',
    manager: '孙七',
    employeeCount: 25,
    description: '管理上海地区的连锁药房运营',
    location: '上海市浦东新区',
    foundedDate: '2012-04-18',
    children: [
      {
        id: '9',
        name: '零售药房',
        manager: '周八',
        employeeCount: 12,
        description: '上海地区线下药房的日常运营',
        location: '上海市浦东新区',
        foundedDate: '2012-06-10',
      },
      {
        id: '10',
        name: '配送中心',
        manager: '吴九',
        employeeCount: 8,
        description: '负责上海地区中药配送',
        location: '上海市嘉定区',
        foundedDate: '2012-07-22',
      },
    ],
  },
];

function Organization() {
  const [departments, setDepartments] = useState(initialDepartments);
  const [openDialog, setOpenDialog] = useState(false);
  const [selectedDepartment, setSelectedDepartment] = useState(null);
  const [detailDepartment, setDetailDepartment] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    manager: '',
    employeeCount: 0,
    description: '',
    location: '',
    foundedDate: '',
    parentId: '',
  });
  
  // 新增AI分析相关状态
  const [openAIDialog, setOpenAIDialog] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiTabValue, setAiTabValue] = useState(0);
  const [aiAnalysisData, setAiAnalysisData] = useState({
    costControl: null,
    efficiency: null,
  });

  const handleOpenDialog = (department) => {
    if (department) {
      setSelectedDepartment(department);
      setFormData({
        name: department.name,
        manager: department.manager,
        employeeCount: department.employeeCount,
        description: department.description || '',
        location: department.location || '',
        foundedDate: department.foundedDate || '',
        parentId: getParentId(departments, department.id) || '',
      });
    } else {
      setSelectedDepartment(null);
      setFormData({
        name: '',
        manager: '',
        employeeCount: 0,
        description: '',
        location: '',
        foundedDate: '',
        parentId: '',
      });
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setSelectedDepartment(null);
  };

  const handleDeleteDepartment = (departmentId) => {
    if (window.confirm('确定要删除此部门吗？')) {
      const deleteDepartment = (depts) => {
        return depts.filter(dept => {
          if (dept.id === departmentId) {
            return false;
          }
          if (dept.children) {
            dept.children = deleteDepartment(dept.children);
          }
          return true;
        });
      };
      
      setDepartments(deleteDepartment(departments));
      if (detailDepartment && detailDepartment.id === departmentId) {
        setDetailDepartment(null);
      }
    }
  };

  const handleSubmit = () => {
    const newDeptData = {
      name: formData.name,
      manager: formData.manager,
      employeeCount: parseInt(formData.employeeCount),
      description: formData.description,
      location: formData.location,
      foundedDate: formData.foundedDate,
    };

    if (selectedDepartment) {
      // 更新部门
      const updateDepartment = (depts) => {
        return depts.map(dept => {
          if (dept.id === selectedDepartment.id) {
            // 保留children属性
            return { ...dept, ...newDeptData };
          }
          if (dept.children) {
            return { ...dept, children: updateDepartment(dept.children) };
          }
          return dept;
        });
      };
      
      let updatedDepartments = updateDepartment(departments);
      
      // 如果父部门发生变化，需要重新组织结构
      if (formData.parentId !== getParentId(departments, selectedDepartment.id)) {
        updatedDepartments = moveDepartment(updatedDepartments, selectedDepartment.id, formData.parentId);
      }
      
      setDepartments(updatedDepartments);
      
      // 更新详情视图
      if (detailDepartment && detailDepartment.id === selectedDepartment.id) {
        const findUpdatedDept = findDepartmentById(updatedDepartments, selectedDepartment.id);
        if (findUpdatedDept) {
          setDetailDepartment(findUpdatedDept);
        }
      }
    } else {
      // 添加新部门
      const newDepartment = {
        id: Date.now().toString(),
        ...newDeptData,
        children: []
      };
      
      // 如果指定了父部门，添加为子部门
      if (formData.parentId) {
        const addChildToDepartment = (depts) => {
          return depts.map(dept => {
            if (dept.id === formData.parentId) {
              return {
                ...dept,
                children: [...(dept.children || []), newDepartment]
              };
            }
            if (dept.children) {
              return { ...dept, children: addChildToDepartment(dept.children) };
            }
            return dept;
          });
        };
        
        setDepartments(addChildToDepartment(departments));
      } else {
        // 否则添加为顶级部门
        setDepartments([...departments, newDepartment]);
      }
    }
    
    handleCloseDialog();
  };

  // 根据部门ID查找部门
  const findDepartmentById = (depts, id) => {
    for (const dept of depts) {
      if (dept.id === id) {
        return dept;
      }
      if (dept.children?.length) {
        const found = findDepartmentById(dept.children, id);
        if (found) return found;
      }
    }
    return null;
  };

  // 获取部门的父部门ID
  const getParentId = (depts, childId, parentId = null) => {
    for (const dept of depts) {
      if (dept.children?.some(child => child.id === childId)) {
        return dept.id;
      }
      if (dept.children?.length) {
        const found = getParentId(dept.children, childId, dept.id);
        if (found) return found;
      }
    }
    return null;
  };

  // 移动部门到新的父部门下
  const moveDepartment = (depts, deptId, newParentId) => {
    // 先找到要移动的部门
    const deptToMove = findDepartmentById(depts, deptId);
    if (!deptToMove) return depts;
    
    // 从原位置移除
    const removeDept = (depts) => {
      return depts.filter(dept => {
        if (dept.id === deptId) {
          return false;
        }
        if (dept.children) {
          dept.children = removeDept(dept.children);
        }
        return true;
      });
    };
    
    let updatedDepts = removeDept(depts);
    
    // 如果没有指定新父部门，则添加为顶级部门
    if (!newParentId) {
      return [...updatedDepts, deptToMove];
    }
    
    // 添加到新的父部门下
    const addToNewParent = (depts) => {
      return depts.map(dept => {
        if (dept.id === newParentId) {
          return {
            ...dept,
            children: [...(dept.children || []), deptToMove]
          };
        }
        if (dept.children) {
          return { ...dept, children: addToNewParent(dept.children) };
        }
        return dept;
      });
    };
    
    return addToNewParent(updatedDepts);
  };

  // 显示部门详情
  const handleShowDetails = (department) => {
    setDetailDepartment(department);
  };

  // 渲染部门节点
  const renderDepartmentNode = (department) => (
    <TreeNode
      key={department.id}
      label={
        <Paper
          elevation={3}
          sx={{
            p: 2,
            minWidth: 200,
            textAlign: 'center',
            backgroundColor: 'primary.light',
            color: 'white',
          }}
        >
          <Typography variant="h6">{department.name}</Typography>
          <Typography variant="body2">负责人: {department.manager}</Typography>
          <Typography variant="body2">员工数: {department.employeeCount}</Typography>
          <Box sx={{ mt: 1, display: 'flex', justifyContent: 'center', gap: 1 }}>
            <Tooltip title="查看详情">
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  handleShowDetails(department);
                }}
                sx={{ color: 'white' }}
              >
                <InfoIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="编辑部门">
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  handleOpenDialog(department);
                }}
                sx={{ color: 'white' }}
              >
                <EditIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="删除部门">
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteDepartment(department.id);
                }}
                sx={{ color: 'white' }}
              >
                <DeleteIcon />
              </IconButton>
            </Tooltip>
          </Box>
        </Paper>
      }
    >
      {department.children?.map(child => renderDepartmentNode(child))}
    </TreeNode>
  );

  // 获取所有可选的父部门
  const getAllDepartments = (depts, excludeId = null) => {
    let result = [];
    depts.forEach(dept => {
      // 不能将部门设为自己的子部门
      if (dept.id !== excludeId) {
        result.push(dept);
        if (dept.children) {
          result = result.concat(getAllDepartments(dept.children, excludeId));
        }
      }
    });
    return result;
  };

  // AI成本控制和效率优化分析
  const handleOpenAIDialog = () => {
    setOpenAIDialog(true);
    performAIAnalysis();
  };

  const handleCloseAIDialog = () => {
    setOpenAIDialog(false);
  };

  const handleAITabChange = (event, newValue) => {
    setAiTabValue(newValue);
  };

  // 模拟AI分析数据获取
  const performAIAnalysis = () => {
    setAiLoading(true);
    
    // 模拟API调用延迟
    setTimeout(() => {
      // 计算部门成本分析
      const costAnalysis = analyzeDepartmentCosts();
      
      // 计算效率优化分析
      const efficiencyAnalysis = analyzeEfficiency();
      
      setAiAnalysisData({
        costControl: costAnalysis,
        efficiency: efficiencyAnalysis,
      });
      
      setAiLoading(false);
    }, 2000);
  };
  
  // AI成本分析算法
  const analyzeDepartmentCosts = () => {
    // 这里是模拟的AI成本分析逻辑
    const totalEmployees = departments.reduce((total, dept) => {
      const deptTotal = countTotalEmployees(dept);
      return total + deptTotal;
    }, 0);
    
    // 各部门成本分析
    const departmentCosts = departments.map(dept => {
      const deptEmployees = countTotalEmployees(dept);
      const costRatio = deptEmployees / totalEmployees;
      const efficiency = Math.random() * 0.4 + 0.6; // 模拟效率评分 (0.6-1.0)
      const costScore = Math.round((1 - costRatio) * 100);
      
      // 成本优化建议
      let suggestions = [];
      if (costRatio > 0.3) {
        suggestions.push(`考虑精简${dept.name}的人员结构，当前占比${(costRatio * 100).toFixed(1)}%过高`);
      }
      if (deptEmployees > 20 && efficiency < 0.8) {
        suggestions.push(`${dept.name}人员较多但效率不高，建议进行内部重组`);
      }
      if (dept.children && dept.children.length > 3) {
        suggestions.push(`${dept.name}子部门数量较多，可考虑合并相似职能部门`);
      }
      
      return {
        id: dept.id,
        name: dept.name,
        employeeCount: deptEmployees,
        costRatio: costRatio,
        costScore: costScore,
        efficiency: efficiency,
        suggestions: suggestions
      };
    }).sort((a, b) => a.costScore - b.costScore); // 按成本得分排序
    
    // 整体成本控制建议
    const overallSuggestions = [
      "通过AI系统自动化处理部分行政工作，减少人力成本",
      "实施基于AI的动态人员配置，根据业务量自动调整各部门人员",
      "引入智能绩效分析系统，优化人员结构与薪酬体系",
      "通过远程办公和灵活工作制度减少办公场地成本",
      "实施集中采购和供应链优化，降低运营成本"
    ];
    
    return {
      departmentCosts,
      overallSuggestions,
      potentialSavings: Math.round(Math.random() * 15 + 10) // 模拟10-25%的潜在节省
    };
  };
  
  // AI效率优化分析
  const analyzeEfficiency = () => {
    // 这里是模拟的AI效率分析逻辑
    
    // 各部门效率分析
    const departmentEfficiency = departments.map(dept => {
      // 模拟效率相关指标
      const processingSpeed = Math.random() * 0.5 + 0.5; // 0.5-1.0
      const resourceUtilization = Math.random() * 0.4 + 0.6; // 0.6-1.0
      const coordinationScore = Math.random() * 0.3 + 0.7; // 0.7-1.0
      
      // 效率优化建议
      let suggestions = [];
      if (processingSpeed < 0.7) {
        suggestions.push(`优化${dept.name}的工作流程，提高处理速度`);
      }
      if (resourceUtilization < 0.75) {
        suggestions.push(`提高${dept.name}的资源利用率，减少闲置资源`);
      }
      if (coordinationScore < 0.8) {
        suggestions.push(`改善${dept.name}与其他部门的协作机制`);
      }
      if (dept.children && dept.children.length > 0) {
        suggestions.push(`简化${dept.name}的汇报层级，缩短决策链`);
      }
      
      const overallScore = (processingSpeed + resourceUtilization + coordinationScore) / 3;
      
      return {
        id: dept.id,
        name: dept.name,
        processingSpeed: processingSpeed,
        resourceUtilization: resourceUtilization,
        coordinationScore: coordinationScore,
        overallScore: overallScore,
        suggestions: suggestions
      };
    }).sort((a, b) => a.overallScore - b.overallScore); // 按整体得分排序
    
    // 整体效率优化建议
    const overallSuggestions = [
      "部署AI驱动的工作流管理系统，自动化分配和追踪任务",
      "实施智能会议系统，减少不必要的会议时间",
      "引入自动化文档处理和知识管理系统",
      "建立跨部门协作平台，减少信息孤岛",
      "利用AI分析历史数据，预测业务需求并优化资源分配"
    ];
    
    const potentialImprovement = Math.round(Math.random() * 20 + 15); // 模拟15-35%的潜在改进
    
    return {
      departmentEfficiency,
      overallSuggestions,
      potentialImprovement
    };
  };
  
  // 计算部门及其子部门的总员工数
  const countTotalEmployees = (department) => {
    let total = department.employeeCount;
    
    if (department.children && department.children.length > 0) {
      department.children.forEach(child => {
        total += countTotalEmployees(child);
      });
    }
    
    return total;
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h4">组织结构管理</Typography>
        <Box>
          <Button
            variant="contained"
            color="secondary"
            startIcon={<AIIcon />}
            onClick={handleOpenAIDialog}
            sx={{ mr: 2 }}
          >
            AI成本控制与效率优化分析
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => handleOpenDialog()}
          >
            添加部门
          </Button>
        </Box>
      </Box>

      <Grid container spacing={3}>
        <Grid item xs={12} md={detailDepartment ? 8 : 12}>
          <Paper sx={{ p: 3, overflowX: 'auto' }}>
            <Box sx={{ minWidth: 800 }}>
              <Tree
                lineWidth="2px"
                lineColor="#4A6572"
                lineBorderRadius="10px"
                label={<div></div>}
              >
                {departments.map(dept => renderDepartmentNode(dept))}
              </Tree>
            </Box>
          </Paper>
        </Grid>
        
        {detailDepartment && (
          <Grid item xs={12} md={4}>
            <Card>
              <CardHeader 
                title="部门详情" 
                action={
                  <IconButton onClick={() => setDetailDepartment(null)}>
                    <InfoIcon />
                  </IconButton>
                }
              />
              <Divider />
              <CardContent>
                <Typography variant="h6" gutterBottom>{detailDepartment.name}</Typography>
                <Box sx={{ mb: 2 }}>
                  <Chip 
                    icon={<PersonAddIcon />} 
                    label={`负责人: ${detailDepartment.manager}`} 
                    color="primary" 
                    sx={{ mr: 1, mb: 1 }}
                  />
                  <Chip 
                    label={`员工数: ${detailDepartment.employeeCount}`} 
                    color="secondary" 
                    sx={{ mr: 1, mb: 1 }}
                  />
                </Box>
                
                {detailDepartment.description && (
                  <Typography variant="body2" paragraph>
                    <strong>部门简介:</strong> {detailDepartment.description}
                  </Typography>
                )}
                
                {detailDepartment.location && (
                  <Typography variant="body2" paragraph>
                    <strong>所在地点:</strong> {detailDepartment.location}
                  </Typography>
                )}
                
                {detailDepartment.foundedDate && (
                  <Typography variant="body2" paragraph>
                    <strong>成立日期:</strong> {detailDepartment.foundedDate}
                  </Typography>
                )}
                
                <Box sx={{ mt: 2 }}>
                  <Button 
                    variant="contained" 
                    startIcon={<EditIcon />}
                    onClick={() => handleOpenDialog(detailDepartment)}
                    fullWidth
                  >
                    编辑部门
                  </Button>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        )}
      </Grid>

      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="md" fullWidth>
        <DialogTitle>
          {selectedDepartment ? '编辑部门' : '添加部门'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} md={6}>
              <TextField
                label="部门名称"
                fullWidth
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                label="负责人"
                fullWidth
                value={formData.manager}
                onChange={(e) => setFormData({ ...formData, manager: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                label="员工数量"
                type="number"
                fullWidth
                value={formData.employeeCount}
                onChange={(e) => setFormData({ ...formData, employeeCount: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>上级部门</InputLabel>
                <Select
                  value={formData.parentId}
                  label="上级部门"
                  onChange={(e) => setFormData({ ...formData, parentId: e.target.value })}
                >
                  <MenuItem value="">无上级部门</MenuItem>
                  {getAllDepartments(departments, selectedDepartment?.id).map(dept => (
                    <MenuItem key={dept.id} value={dept.id}>{dept.name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="部门简介"
                fullWidth
                multiline
                rows={2}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                label="所在地点"
                fullWidth
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                label="成立日期"
                type="date"
                fullWidth
                InputLabelProps={{ shrink: true }}
                value={formData.foundedDate}
                onChange={(e) => setFormData({ ...formData, foundedDate: e.target.value })}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>取消</Button>
          <Button onClick={handleSubmit} variant="contained">
            确定
          </Button>
        </DialogActions>
      </Dialog>

      {/* AI分析对话框 */}
      <Dialog 
        open={openAIDialog} 
        onClose={handleCloseAIDialog} 
        maxWidth="lg" 
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center' }}>
          <AIIcon sx={{ mr: 1 }} />
          AI驱动的组织结构分析
        </DialogTitle>
        <DialogContent>
          {aiLoading ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', my: 4 }}>
              <CircularProgress />
              <Typography sx={{ mt: 2 }}>
                AI正在分析组织结构数据并生成优化建议...
              </Typography>
            </Box>
          ) : (
            <Box sx={{ width: '100%' }}>
              <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
                <Tabs value={aiTabValue} onChange={handleAITabChange}>
                  <Tab icon={<CostIcon />} label="成本控制" />
                  <Tab icon={<EfficiencyIcon />} label="效率优化" />
                </Tabs>
              </Box>
              
              {/* 成本控制分析 */}
              {aiTabValue === 0 && aiAnalysisData.costControl && (
                <Box sx={{ p: 2 }}>
                  <Alert severity="info" sx={{ mb: 2 }}>
                    <Typography variant="subtitle1">
                      <strong>AI分析结果：</strong> 通过优化组织结构，您可以潜在节省 
                      <strong>{aiAnalysisData.costControl.potentialSavings}%</strong> 的人力成本
                    </Typography>
                  </Alert>
                  
                  <Typography variant="h6" sx={{ mt: 3, mb: 2 }}>
                    <CostIcon sx={{ verticalAlign: 'middle', mr: 1 }} />
                    部门成本分析
                  </Typography>
                  
                  <Grid container spacing={2}>
                    {aiAnalysisData.costControl.departmentCosts.map(dept => (
                      <Grid item xs={12} md={6} key={dept.id}>
                        <Card variant="outlined" sx={{ mb: 2 }}>
                          <CardContent>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <Typography variant="h6">{dept.name}</Typography>
                              <Chip 
                                label={`成本评分: ${dept.costScore}/100`} 
                                color={dept.costScore < 50 ? "error" : dept.costScore < 70 ? "warning" : "success"}
                              />
                            </Box>
                            <Typography variant="body2" sx={{ mb: 1 }}>
                              员工数: {dept.employeeCount} 人 
                              (占比 {(dept.costRatio * 100).toFixed(1)}%)
                            </Typography>
                            <Typography variant="body2" sx={{ mb: 2 }}>
                              运行效率: {(dept.efficiency * 100).toFixed()}%
                            </Typography>
                            
                            {dept.suggestions.length > 0 && (
                              <Box>
                                <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
                                  <InsightIcon sx={{ fontSize: 16, verticalAlign: 'text-bottom', mr: 0.5 }} />
                                  AI优化建议:
                                </Typography>
                                <List dense disablePadding>
                                  {dept.suggestions.map((suggestion, i) => (
                                    <ListItem key={i} disablePadding sx={{ py: 0.5 }}>
                                      <ListItemIcon sx={{ minWidth: 30 }}>
                                        <OptimizeIcon fontSize="small" color="primary" />
                                      </ListItemIcon>
                                      <ListItemText primary={suggestion} />
                                    </ListItem>
                                  ))}
                                </List>
                              </Box>
                            )}
                          </CardContent>
                        </Card>
                      </Grid>
                    ))}
                  </Grid>
                  
                  <Typography variant="h6" sx={{ mt: 4, mb: 2 }}>
                    <InsightIcon sx={{ verticalAlign: 'middle', mr: 1 }} />
                    整体成本优化建议
                  </Typography>
                  
                  <List>
                    {aiAnalysisData.costControl.overallSuggestions.map((suggestion, i) => (
                      <ListItem key={i}>
                        <ListItemIcon>
                          <OptimizeIcon color="primary" />
                        </ListItemIcon>
                        <ListItemText primary={suggestion} />
                      </ListItem>
                    ))}
                  </List>
                </Box>
              )}
              
              {/* 效率优化分析 */}
              {aiTabValue === 1 && aiAnalysisData.efficiency && (
                <Box sx={{ p: 2 }}>
                  <Alert severity="info" sx={{ mb: 2 }}>
                    <Typography variant="subtitle1">
                      <strong>AI分析结果：</strong> 通过实施优化建议，您可以潜在提升 
                      <strong>{aiAnalysisData.efficiency.potentialImprovement}%</strong> 的组织运行效率
                    </Typography>
                  </Alert>
                  
                  <Typography variant="h6" sx={{ mt: 3, mb: 2 }}>
                    <EfficiencyIcon sx={{ verticalAlign: 'middle', mr: 1 }} />
                    部门效率分析
                  </Typography>
                  
                  <Grid container spacing={2}>
                    {aiAnalysisData.efficiency.departmentEfficiency.map(dept => (
                      <Grid item xs={12} md={6} key={dept.id}>
                        <Card variant="outlined" sx={{ mb: 2 }}>
                          <CardContent>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <Typography variant="h6">{dept.name}</Typography>
                              <Chip 
                                label={`效率评分: ${(dept.overallScore * 100).toFixed()}/100`} 
                                color={dept.overallScore < 0.7 ? "error" : dept.overallScore < 0.8 ? "warning" : "success"}
                              />
                            </Box>
                            
                            <Box sx={{ mt: 2, mb: 0.5 }}>
                              <Typography variant="body2" sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span>工作流程效率:</span>
                                <span>{(dept.processingSpeed * 100).toFixed()}%</span>
                              </Typography>
                              <LinearProgress 
                                variant="determinate" 
                                value={dept.processingSpeed * 100} 
                                color={dept.processingSpeed < 0.7 ? "error" : "success"}
                                sx={{ my: 0.5 }}
                              />
                            </Box>
                            
                            <Box sx={{ mb: 0.5 }}>
                              <Typography variant="body2" sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span>资源利用率:</span>
                                <span>{(dept.resourceUtilization * 100).toFixed()}%</span>
                              </Typography>
                              <LinearProgress 
                                variant="determinate" 
                                value={dept.resourceUtilization * 100} 
                                color={dept.resourceUtilization < 0.75 ? "warning" : "success"}
                                sx={{ my: 0.5 }}
                              />
                            </Box>
                            
                            <Box sx={{ mb: 2 }}>
                              <Typography variant="body2" sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span>部门协作度:</span>
                                <span>{(dept.coordinationScore * 100).toFixed()}%</span>
                              </Typography>
                              <LinearProgress 
                                variant="determinate" 
                                value={dept.coordinationScore * 100} 
                                color={dept.coordinationScore < 0.8 ? "warning" : "success"}
                                sx={{ my: 0.5 }}
                              />
                            </Box>
                            
                            {dept.suggestions.length > 0 && (
                              <Box>
                                <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
                                  <InsightIcon sx={{ fontSize: 16, verticalAlign: 'text-bottom', mr: 0.5 }} />
                                  AI效率优化建议:
                                </Typography>
                                <List dense disablePadding>
                                  {dept.suggestions.map((suggestion, i) => (
                                    <ListItem key={i} disablePadding sx={{ py: 0.5 }}>
                                      <ListItemIcon sx={{ minWidth: 30 }}>
                                        <OptimizeIcon fontSize="small" color="secondary" />
                                      </ListItemIcon>
                                      <ListItemText primary={suggestion} />
                                    </ListItem>
                                  ))}
                                </List>
                              </Box>
                            )}
                          </CardContent>
                        </Card>
                      </Grid>
                    ))}
                  </Grid>
                  
                  <Typography variant="h6" sx={{ mt: 4, mb: 2 }}>
                    <InsightIcon sx={{ verticalAlign: 'middle', mr: 1 }} />
                    整体效率优化建议
                  </Typography>
                  
                  <List>
                    {aiAnalysisData.efficiency.overallSuggestions.map((suggestion, i) => (
                      <ListItem key={i}>
                        <ListItemIcon>
                          <OptimizeIcon color="secondary" />
                        </ListItemIcon>
                        <ListItemText primary={suggestion} />
                      </ListItem>
                    ))}
                  </List>
                </Box>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseAIDialog}>关闭</Button>
          <Button 
            variant="contained" 
            startIcon={<AIIcon />}
            onClick={performAIAnalysis}
            disabled={aiLoading}
          >
            重新分析
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default Organization; 