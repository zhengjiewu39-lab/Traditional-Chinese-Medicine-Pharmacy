import { createTheme } from '@mui/material/styles';

// 以中医药传统色彩为基础的配色方案
const theme = createTheme({
  palette: {
    primary: {
      light: '#8c9e75', // 浅竹绿
      main: '#5c8d89', // 青绿（类似艾叶青色）
      dark: '#436b67', // 深青绿
      contrastText: '#fff',
    },
    secondary: {
      light: '#e6b89c', // 淡赭石色
      main: '#d48265', // 赭石色（中医常用颜色）
      dark: '#b25d46', // 深赭石色
      contrastText: '#fff',
    },
    success: {
      main: '#739e73', // 温和的绿色
    },
    error: {
      main: '#b25d46', // 温和的红色
    },
    warning: {
      main: '#d4a265', // 温和的黄棕色
    },
    info: {
      main: '#6a8caf', // 温和的蓝色
    },
    background: {
      default: '#f9f7f2', // 米纸色
      paper: '#ffffff',
    },
    text: {
      primary: '#333333',
      secondary: '#666666',
    },
  },
  typography: {
    fontFamily: [
      '-apple-system',
      'BlinkMacSystemFont',
      '"PingFang SC"',
      '"Segoe UI"',
      '"Helvetica Neue"',
      'Arial',
      'sans-serif',
      '"Apple Color Emoji"',
      '"Segoe UI Emoji"',
      '"Segoe UI Symbol"',
    ].join(','),
    h1: {
      fontSize: '2.5rem',
      fontWeight: 500,
    },
    h2: {
      fontSize: '2rem',
      fontWeight: 500,
    },
    h3: {
      fontSize: '1.75rem',
      fontWeight: 500,
    },
    h4: {
      fontSize: '1.5rem',
      fontWeight: 500,
    },
    h5: {
      fontSize: '1.25rem',
      fontWeight: 500,
    },
    h6: {
      fontSize: '1rem',
      fontWeight: 500,
    },
    body1: {
      fontSize: '1rem',
    },
    body2: {
      fontSize: '0.875rem',
    },
  },
  shape: {
    borderRadius: 8,
  },
  components: {
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: '#5c8d89', // 青绿色导航栏
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          borderRadius: 6,
        },
        containedPrimary: {
          boxShadow: 'none',
          '&:hover': {
            boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)',
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.05)',
          borderRadius: 12,
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundColor: '#f5f5f5',
          borderRight: 'none',
        },
      },
    },
    MuiTableHead: {
      styleOverrides: {
        root: {
          backgroundColor: 'rgba(92, 141, 137, 0.05)', // 主色半透明底色
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        head: {
          fontWeight: 600,
          color: '#5c8d89', // 主色表头文字
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          fontWeight: 500,
        },
      },
    },
  },
});

export default theme; 