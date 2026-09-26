import React, { useState, useEffect, useMemo } from 'react';
// ... 其他导入

// 生成模拟数据数组
function generateArray(base, count, generator) {
  return Array.from({ length: count }, (_, i) => generator(i, base));
}

// 产品名称数组
const productNames = [
  '人参', '灵芝', '当归', '黄芪', '枸杞', '川芎', '白术', '三七', '丹参', '天麻',
  '五味子', '牛膝', '肉苁蓉', '附子', '薏苡仁', '板蓝根', '金银花', '菊花', '党参', '白术',
  '防风', '柴胡', '桂枝', '苓苏', '泽泻', '石斛', '麦冬', '天冬', '知母', '黄连',
  '黄柏', '连翘', '紫苏', '苏叶', '桑叶', '桑葚', '地黄', '熟地', '山药', '山茱萸',
  '杜仲', '女贞子', '何首乌', '百合', '芍药', '竹沥', '竹叶', '甘草', '陈皮', '半夏'
];

const customerNames = generateArray('客户', 50, (i) => `客户${i + 1}`);
const orderStatus = ['pending', 'completed', 'cancelled', 'processing'];

const mockData = {
  // 销售数据
  salesData: [
    { name: '1月', 销售额: 250000, 成本: 150000, 利润: 100000, 目标: 280000 },
    { name: '2月', 销售额: 230000, 成本: 145000, 利润: 85000, 目标: 280000 },
    { name: '3月', 销售额: 260000, 成本: 152000, 利润: 108000, 目标: 280000 },
    { name: '4月', 销售额: 290000, 成本: 160000, 利润: 130000, 目标: 300000 },
    { name: '5月', 销售额: 310000, 成本: 168000, 利润: 142000, 目标: 300000 },
    { name: '6月', 销售额: 350000, 成本: 185000, 利润: 165000, 目标: 300000 },
    { name: '7月', 销售额: 320000, 成本: 175000, 利润: 145000, 目标: 320000 },
    { name: '8月', 销售额: 340000, 成本: 180000, 利润: 160000, 目标: 320000 },
    { name: '9月', 销售额: 380000, 成本: 195000, 利润: 185000, 目标: 320000 },
    { name: '10月', 销售额: 420000, 成本: 210000, 利润: 210000, 目标: 350000 },
    { name: '11月', 销售额: 450000, 成本: 220000, 利润: 230000, 目标: 350000 },
    { name: '12月', 销售额: 500000, 成本: 240000, 利润: 260000, 目标: 350000 }
  ],

  // 客户数据
  customerData: {
    total: 5000,
    new: 120,
    active: 4200,
    inactive: 800,
    growth: generateArray(null, 12, (i) => ({
      name: `${i + 1}月`,
      新客户: Math.floor(Math.random() * 200) + 50,
      老客户: Math.floor(Math.random() * 400) + 100
    })),
    topCustomers: generateArray(null, 50, (i) => ({
      name: customerNames[i],
      purchases: Math.floor(Math.random() * 60) + 10,
      total: Math.floor(Math.random() * 20000) + 2000,
      lastVisit: `2024-06-${(i % 30) + 1}`,
    })),
  },

  // 订单数据
  ordersData: {
    total: 1200,
    pending: 30,
    completed: 1100,
    cancelled: 70,
    recentOrders: generateArray(null, 50, (i) => ({
      id: `ORD${1000 + i}`,
      customer: customerNames[i % customerNames.length],
      amount: Math.floor(Math.random() * 1000) + 100,
      status: orderStatus[Math.floor(Math.random() * orderStatus.length)],
      date: `2024-06-${(i % 30) + 1}`
    })),
  },

  // 其他数据保持不变...
};

function Dashboard() {
  // 组件逻辑保持不变...
  
  return (
    // 组件渲染保持不变...
    <div>Dashboard组件</div>
  );
}

export default Dashboard; 