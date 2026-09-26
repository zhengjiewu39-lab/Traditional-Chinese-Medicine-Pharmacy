import React, { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Card,
  CardContent,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import { Tree, TreeNode } from 'react-organizational-chart';

interface Department {
  id: string;
  name: string;
  manager: string;
  employeeCount: number;
  children?: Department[];
}

const initialDepartments: Department[] = [
  {
    id: '1',
    name: '总部',
    manager: '张三',
    employeeCount: 50,
    children: [
      {
        id: '2',
        name: '采购部',
        manager: '李四',
        employeeCount: 15,
      },
      {
        id: '3',
        name: '销售部',
        manager: '王五',
        employeeCount: 20,
      },
      {
        id: '4',
        name: '质量部',
        manager: '赵六',
        employeeCount: 10,
      },
    ],
  },
];

const Organization: React.FC = () => {
  const [departments, setDepartments] = useState<Department[]>(initialDepartments);
  const [openDialog, setOpenDialog] = useState(false);
  const [selectedDepartment, setSelectedDepartment] = useState<Department | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    manager: '',
    employeeCount: 0,
  });

  const handleOpenDialog = (department?: Department) => {
    if (department) {
      setSelectedDepartment(department);
      setFormData({
        name: department.name,
        manager: department.manager,
        employeeCount: department.employeeCount,
      });
    } else {
      setSelectedDepartment(null);
      setFormData({
        name: '',
        manager: '',
        employeeCount: 0,
      });
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setSelectedDepartment(null);
  };

  const handleSubmit = () => {
    if (selectedDepartment) {
      // 更新部门
      const updateDepartment = (depts: Department[]): Department[] => {
        return depts.map(dept => {
          if (dept.id === selectedDepartment.id) {
            return { ...dept, ...formData };
          }
          if (dept.children) {
            return { ...dept, children: updateDepartment(dept.children) };
          }
          return dept;
        });
      };
      setDepartments(updateDepartment(departments));
    } else {
      // 添加新部门
      const newDepartment: Department = {
        id: Date.now().toString(),
        ...formData,
      };
      setDepartments([...departments, newDepartment]);
    }
    handleCloseDialog();
  };

  const renderDepartmentNode = (department: Department) => (
    <TreeNode
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
          <Box sx={{ mt: 1 }}>
            <IconButton
              size="small"
              onClick={() => handleOpenDialog(department)}
              sx={{ color: 'white' }}
            >
              <EditIcon />
            </IconButton>
          </Box>
        </Paper>
      }
    >
      {department.children?.map(child => renderDepartmentNode(child))}
    </TreeNode>
  );

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h4">组织结构管理</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => handleOpenDialog()}
        >
          添加部门
        </Button>
      </Box>

      <Grid container spacing={3}>
        <Grid item xs={12}>
          <Paper sx={{ p: 3 }}>
            <Tree
              lineWidth="2px"
              lineColor="#4A6572"
              lineBorderRadius="10px"
            >
              {departments.map(dept => renderDepartmentNode(dept))}
            </Tree>
          </Paper>
        </Grid>
      </Grid>

      <Dialog open={openDialog} onClose={handleCloseDialog}>
        <DialogTitle>
          {selectedDepartment ? '编辑部门' : '添加部门'}
        </DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="部门名称"
            fullWidth
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          />
          <TextField
            margin="dense"
            label="负责人"
            fullWidth
            value={formData.manager}
            onChange={(e) => setFormData({ ...formData, manager: e.target.value })}
          />
          <TextField
            margin="dense"
            label="员工数量"
            type="number"
            fullWidth
            value={formData.employeeCount}
            onChange={(e) => setFormData({ ...formData, employeeCount: parseInt(e.target.value) })}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>取消</Button>
          <Button onClick={handleSubmit} variant="contained">
            确定
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Organization; 