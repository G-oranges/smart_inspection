/**
 * 导入向导配置文件
 * 定义不同模块的导入字段、唯一键、校验规则等
 *
 * 设计原则：
 * 1. ImportWizardModal 组件完全配置驱动，不得出现业务特有硬编码
 * 2. 每个模块（dorm/student/checkin）独立定义完整配置
 * 3. codeFields 由 config 驱动，传入 preprocessRows
 */

export const DORM_IMPORT_CONFIG = {
  mode: 'dorm',
  title: '宿舍信息导入',

  // 模板配置
  template: {
    emptyTemplateName: '宿舍导入空模板.xlsx',
    sampleTemplateName: '宿舍导入示例模板.xlsx',
    sheetName: '宿舍数据',
    downloadUrl: '/api/v2/infra/dorms/template',
    // 示例行数据（用于生成示例模板）
    sampleRow: {
      campus: '主校区',
      building: '1号楼',
      floor: 3,
      roomNo: '301',
      capacity: 4,
      gender: '男',
      grade: '2024',
    },
  },

  // 字段定义（顺序即模板列顺序和导出列顺序）
  fields: [
    {
      key: 'campus',
      label: '校区',
      required: true,
      type: 'string',
      description: '所属校区名称',
    },
    {
      key: 'building',
      label: '楼栋',
      required: true,
      type: 'string',
      description: '所属楼栋名称',
    },
    {
      key: 'floor',
      label: '楼层',
      required: false,
      type: 'int',
      min: 1,
      description: '物理楼层（正整数）',
    },
    {
      key: 'roomNo',
      label: '房间号',
      required: true,
      type: 'string',
      description: '宿舍门牌号',
    },
    {
      key: 'capacity',
      label: '床位数',
      required: true,
      type: 'int',
      min: 1,
      max: 20,
      description: '额定容量（1-20 的整数）',
    },
    {
      key: 'gender',
      label: '入住性别',
      required: true,
      type: 'string',
      enum: ['男', '女', '混合', '未指定'],
      description: '入住性别限制',
    },
    {
      key: 'grade',
      label: '所属年级',
      required: false,
      type: 'string',
      description: '计划分配年级',
    },
  ],

  // 必填字段（用于前端映射校验）
  requiredFields: ['campus', 'building', 'roomNo', 'capacity', 'gender'],

  // 编码类字段（不应含小数、科学计数法，传给 preprocessRows）
  codeFields: ['roomNo', 'grade'],

  // 复合唯一键（用于 C 类冲突校验提示）
  uniqueKeys: ['campus', 'building', 'roomNo'],
  uniqueKeyDescription: '校区 + 楼栋 + 房间号',

  // 冲突处理策略
  strategies: ['SKIP', 'OVERWRITE'],
  strategyDescriptions: {
    SKIP: '跳过重复行，保留系统中原有记录',
    OVERWRITE: '覆盖重复行，使用新数据更新原有记录',
  },

  // API 端点
  api: {
    preview: '/api/v2/infra/dorms/import/preview',
    execute: '/api/v2/infra/dorms/import/execute',
  },

  // 导入限制
  limits: {
    maxFileSize: 5 * 1024 * 1024, // 5MB 文件大小上限
    maxRows: 20000, // 前端行数上限
  },

  // 注意事项（用于 Step 1 展示）
  notes: [
    '系统仅支持 <strong>.xls</strong> 和 <strong>.xlsx</strong> 格式。',
    '请勿修改模板中的第一行表头。',
    '【入住性别】仅支持：男、女、混合、未指定。',
  ],
}

/**
 * 楼栋导入配置
 */
export const BUILDING_IMPORT_CONFIG = {
  mode: 'building',
  title: '楼栋信息导入',

  // 模板配置
  template: {
    emptyTemplateName: '楼栋导入空模板.xlsx',
    sampleTemplateName: '楼栋导入示例模板.xlsx',
    sheetName: '楼栋数据',
    downloadUrl: '/api/v2/infra/buildings/template',
    sampleRow: {
      name: '荟园1栋',
      campus: '本部',
      type: '混合',
      floors: 6,
      hasElevator: '有',
      contactInfo: '宿管办 010-12345678',
    },
  },

  // 字段定义
  fields: [
    {
      key: 'name',
      label: '楼栋名称',
      required: true,
      type: 'string',
      description: '楼栋名称',
    },
    {
      key: 'campus',
      label: '校区',
      required: true,
      type: 'string',
      description: '所属校区名称',
    },
    {
      key: 'type',
      label: '类型',
      required: true,
      type: 'string',
      enum: ['男', '女', '混合'],
      description: '宿舍类型',
    },
    {
      key: 'floors',
      label: '楼层数',
      required: true,
      type: 'int',
      min: 1,
      max: 50,
      description: '楼层数量（1-50 的整数）',
    },
    {
      key: 'hasElevator',
      label: '是否有电梯',
      required: false,
      type: 'string',
      enum: ['有', '无'],
      description: '是否配备电梯',
    },
    {
      key: 'contactInfo',
      label: '联系方式',
      required: false,
      type: 'string',
      description: '宿管联系方式或值班电话',
    },
  ],

  requiredFields: ['name', 'campus', 'type', 'floors'],

  normalizers: {
    type: {
      男生宿舍: '男',
      女生宿舍: '女',
      混合宿舍: '混合',
    },
    hasElevator: {
      是: '有',
      否: '无',
      有: '有',
      无: '无',
      true: '有',
      false: '无',
      TRUE: '有',
      FALSE: '无',
      '1': '有',
      '0': '无',
    },
  },

  uniqueKeys: ['campus', 'name'],
  uniqueKeyDescription: '校区+楼栋名称',

  strategies: ['SKIP', 'OVERWRITE'],
  strategyDescriptions: {
    SKIP: '跳过冲突行，保留系统中已有的楼栋信息',
    OVERWRITE: '覆盖冲突行，使用新数据更新楼栋信息',
  },

  api: {
    preview: '/api/v2/infra/buildings/import/preview',
    execute: '/api/v2/infra/buildings/import/execute',
  },

  limits: {
    maxFileSize: 5 * 1024 * 1024,
    maxRows: 20000,
  },

  notes: [
    '系统仅支持 <strong>.xls</strong> 和 <strong>.xlsx</strong> 格式。',
    '请勿修改模板中的第一行表头。',
    '【类型】仅支持：男、女、混合。',
    '【是否有电梯】建议填写：有/无 或 是/否。',
  ],
}

/**
 * 学生导入配置
 * 字段定义与后端 Student 模型完全对齐
 * 分组：核心基础信息（必填）、学籍与联系（重要）、背景扩展（可选）
 */
export const STUDENT_IMPORT_CONFIG = {
  mode: 'student',
  title: '学生信息导入',

  // 模板配置
  template: {
    emptyTemplateName: '学生导入空模板.xlsx',
    sampleTemplateName: '学生导入示例模板.xlsx',
    sheetName: '学生数据',
    downloadUrl: '/api/templates/students',
    // 示例行数据
    sampleRow: {
      studentNo: '2024010101',
      fullName: '张三',
      gender: '男',
      grade: '2024',
      college: '计算机学院',
      major: '软件工程',
      className: '软工2401',
      educationLevel: '本科',
      status: '在读',
      mobile: '13800138000',
      isMonitor: '否',
      idType: '居民身份证',
      idNumber: '110101200001011234',
      politicalStatus: '共青团员',
      ethnicity: '汉族',
      nativePlace: '北京市',
      homeAddress: '北京市朝阳区xxx路xxx号',
      phone: '010-12345678',
    },
  },

  // 字段定义（按分组排序）
  fields: [
    // ========== 1. 核心基础信息（必填） ==========
    {
      key: 'studentNo',
      label: '学号',
      required: true,
      type: 'string',
      group: '核心基础信息',
      description: '学生唯一编号',
      help: '必须唯一，建议使用学校统一编号',
    },
    {
      key: 'fullName',
      label: '姓名',
      required: true,
      type: 'string',
      group: '核心基础信息',
      description: '学生真实姓名',
    },
    {
      key: 'gender',
      label: '性别',
      required: true,
      type: 'enum',
      group: '核心基础信息',
      enumOptions: ['男', '女', '未指定'],
      description: '学生性别',
      help: '仅支持：男、女、未指定',
    },

    // ========== 2. 学籍与联系信息（重要） ==========
    {
      key: 'grade',
      label: '年级',
      required: false,
      type: 'string',
      group: '学籍与联系信息',
      description: '入学年级，如 2024',
    },
    {
      key: 'college',
      label: '学院',
      required: false,
      type: 'string',
      group: '学籍与联系信息',
      description: '所属学院名称',
    },
    {
      key: 'major',
      label: '专业',
      required: false,
      type: 'string',
      group: '学籍与联系信息',
      description: '所学专业名称',
    },
    {
      key: 'className',
      label: '班级',
      required: false,
      type: 'string',
      group: '学籍与联系信息',
      description: '所在班级名称',
    },
    {
      key: 'educationLevel',
      label: '培养层次',
      required: false,
      type: 'enum',
      group: '学籍与联系信息',
      enumOptions: ['本科', '硕士', '博士', '专科', '其他'],
      description: '学历层次',
      help: '支持：本科、硕士、博士、专科、其他',
    },
    {
      key: 'status',
      label: '学籍状态',
      required: false,
      type: 'enum',
      group: '学籍与联系信息',
      enumOptions: ['在读', '休学', '退学', '毕业', '结业', '其他'],
      description: '当前学籍状态',
      help: '支持：在读、休学、退学、毕业、结业、其他',
    },
    {
      key: 'mobile',
      label: '手机号',
      required: false,
      type: 'string',
      group: '学籍与联系信息',
      description: '学生手机号码',
      help: '11 位手机号码',
    },
    {
      key: 'isMonitor',
      label: '是否寝室长',
      required: false,
      type: 'boolean',
      group: '学籍与联系信息',
      description: '是否担任寝室长',
      help: '支持：是/否、TRUE/FALSE、1/0',
    },

    // ========== 3. 背景扩展信息（可选） ==========
    {
      key: 'idType',
      label: '证件类型',
      required: false,
      type: 'enum',
      group: '背景扩展信息',
      enumOptions: ['居民身份证', '护照', '港澳通行证', '台胞证', '其他'],
      description: '证件类型',
    },
    {
      key: 'idNumber',
      label: '证件号码',
      required: false,
      type: 'string',
      group: '背景扩展信息',
      description: '证件号码',
    },
    {
      key: 'politicalStatus',
      label: '政治面貌',
      required: false,
      type: 'enum',
      group: '背景扩展信息',
      enumOptions: [
        '群众',
        '共青团员',
        '中共党员',
        '中共预备党员',
        '民主党派',
        '无党派人士',
        '其他',
      ],
      description: '政治面貌',
    },
    {
      key: 'ethnicity',
      label: '民族',
      required: false,
      type: 'string',
      group: '背景扩展信息',
      description: '民族，如汉族、回族等',
    },
    {
      key: 'nativePlace',
      label: '籍贯',
      required: false,
      type: 'string',
      group: '背景扩展信息',
      description: '籍贯地址',
    },
    {
      key: 'homeAddress',
      label: '家庭住址',
      required: false,
      type: 'string',
      group: '背景扩展信息',
      description: '家庭详细地址',
    },
    {
      key: 'qq',
      label: 'QQ号',
      required: false,
      type: 'string',
      group: '背景扩展信息',
      description: 'QQ 号码',
    },
  ],

  // 字段分组（用于 Step3 映射界面展示）
  groups: [
    { key: 'core', label: '核心基础信息', description: '必填项' },
    { key: 'academic', label: '学籍与联系信息', description: '重要信息' },
    { key: 'extended', label: '背景扩展信息', description: '可选' },
  ],

  // 必填字段（用于前端映射校验）
  requiredFields: ['studentNo', 'fullName', 'gender'],

  // 编码类字段（防科学计数法处理）
  codeFields: ['studentNo', 'mobile', 'idNumber', 'phone', 'qq'],

  // 字段值归一化映射（自动标准化常见变体）
  normalizers: {
    // 性别归一化：支持多种常见表达方式
    gender: {
      男性: '男',
      男生: '男',
      M: '男',
      m: '男',
      male: '男',
      Male: '男',
      MALE: '男',
      '♂': '男',
      女性: '女',
      女生: '女',
      F: '女',
      f: '女',
      female: '女',
      Female: '女',
      FEMALE: '女',
      '♀': '女',
      未知: '未指定',
      其他: '未指定',
      不详: '未指定',
      '-': '未指定',
    },
    // 政治面貌归一化
    politicalStatus: {
      // 共青团员
      团员: '共青团员',
      中国共产主义青年团团员: '共青团员',
      共青团: '共青团员',
      // 中共党员
      党员: '中共党员',
      中国共产党党员: '中共党员',
      正式党员: '中共党员',
      // 中共预备党员
      预备党员: '中共预备党员',
      中国共产党预备党员: '中共预备党员',
      // 民主党派
      民主党: '民主党派',
      各民主党派: '民主党派',
      // 群众
      普通群众: '群众',
      //其他
      未确定: '其他',
    },
    // 学籍状态归一化
    status: {
      正常: '在读',
      在校: '在读',
      已毕业: '毕业',
      已退学: '退学',
    },
    // 培养层次归一化
    educationLevel: {
      本科生: '本科',
      研究生: '硕士',
      硕士生: '硕士',
      博士生: '博士',
      大专: '专科',
    },
  },

  // 唯一键（用于 C 类冲突校验）
  uniqueKeys: ['studentNo'],
  uniqueKeyDescription: '学号',

  // 冲突处理策略
  strategies: ['SKIP', 'OVERWRITE'],
  strategyDescriptions: {
    SKIP: '跳过重复行，保留系统中原有记录',
    OVERWRITE: '覆盖重复行，使用新数据更新原有记录',
  },

  // API 端点（V2 增强版）
  api: {
    preview: '/api/v2/students/import/preview',
    execute: '/api/v2/students/import/execute',
  },

  // 导入限制
  limits: {
    maxFileSize: 6 * 1024 * 1024, // 6MB 文件大小上限
    maxRows: 20000, // 前端行数上限
  },

  // 注意事项（用于 Step 1 展示）
  notes: [
    '系统仅支持 <strong>.xls</strong> 和 <strong>.xlsx</strong> 格式。',
    '请勿修改模板中的第一行表头。',
    '<strong>学号、姓名、性别</strong>为必填项。',
    '【性别】仅支持：男、女、未指定。',
    '【是否寝室长】支持：是/否、TRUE/FALSE、1/0。',
    '学号为唯一标识，重复学号将按所选策略处理。',
  ],
}

/**
 * 教职工导入配置
 */
export const TEACHER_IMPORT_CONFIG = {
  mode: 'teacher',
  title: '教职工信息导入',

  template: {
    emptyTemplateName: '教职工导入空模板.xlsx',
    sampleTemplateName: '教职工导入示例模板.xlsx',
    sheetName: '教职工数据',
    downloadUrl: '/api/v2/teachers/template',
    sampleRow: {
      employeeNo: 'T2024001',
      fullName: '李老师',
      gender: '女',
      department: '计算机学院',
      mobile: '13800138000',
      classes: '软工2401, 软工2402',
    },
  },

  fields: [
    {
      key: 'employeeNo',
      label: '工号',
      required: true,
      type: 'string',
      description: '教职工工号（唯一标识）',
    },
    {
      key: 'fullName',
      label: '姓名',
      required: true,
      type: 'string',
      description: '教职工姓名',
    },
    {
      key: 'gender',
      label: '性别',
      required: false,
      type: 'string',
      enum: ['男', '女', '未指定'],
      description: '教职工性别',
    },
    {
      key: 'department',
      label: '院系/部门',
      required: false,
      type: 'string',
      description: '所属院系或部门',
    },
    {
      key: 'mobile',
      label: '手机号',
      required: false,
      type: 'string',
      description: '联系方式',
    },
    {
      key: 'classes',
      label: '负责班级',
      required: false,
      type: 'string',
      description: '所带班级（多个用逗号分隔）',
    },
  ],

  requiredFields: ['employeeNo', 'fullName'],

  codeFields: ['employeeNo', 'mobile'],

  normalizers: {
    gender: {
      男性: '男',
      男生: '男',
      M: '男',
      m: '男',
      male: '男',
      Male: '男',
      MALE: '男',
      女性: '女',
      女生: '女',
      F: '女',
      f: '女',
      female: '女',
      Female: '女',
      FEMALE: '女',
      未知: '未指定',
      其他: '未指定',
      不详: '未指定',
      '-': '未指定',
    },
  },

  uniqueKeys: ['employeeNo'],
  uniqueKeyDescription: '工号',

  strategies: ['SKIP', 'OVERWRITE'],
  strategyDescriptions: {
    SKIP: '跳过冲突行，保留系统中已有的教职工数据',
    OVERWRITE: '覆盖冲突行，使用新数据更新教职工数据',
  },

  api: {
    preview: '/api/v2/teachers/import/preview',
    execute: '/api/v2/teachers/import/execute',
  },

  limits: {
    maxFileSize: 6 * 1024 * 1024,
    maxRows: 20000,
  },

  notes: [
    '系统仅支持 <strong>.xls</strong> 和 <strong>.xlsx</strong> 格式。',
    '请勿修改模板中的第一行表头。',
    '<strong>工号、姓名</strong>为必填项。',
    '【性别】仅支持：男、女、未指定。',
  ],
}

/**
 * 入住导入配置
 * 用于批量办理学生入住，将学生分配到指定床位
 *
 * 设计要点：
 * 1. 所有字段均为必填，确保入住记录完整
 * 2. 唯一键为学号（studentNo），冲突指学生已有入住记录
 * 3. OVERWRITE 策略会先退宿再重新分配
 */
export const CHECKIN_IMPORT_CONFIG = {
  mode: 'checkin',
  title: '入住信息批量导入',

  // 模板配置
  template: {
    emptyTemplateName: '入住导入空模板.xlsx',
    sampleTemplateName: '入住导入示例模板.xlsx',
    sheetName: '入住数据',
    downloadUrl: '/api/templates/occupancy',
    // 示例行数据
    sampleRow: {
      studentNo: '2024010101',
      building: '1号楼',
      roomNo: '301',
      bedNo: '1',
    },
  },

  // 字段定义（全部必填）
  fields: [
    {
      key: 'studentNo',
      label: '学号',
      required: true,
      type: 'string',
      group: '核心信息',
      description: '学生学号，必须在系统中已存在',
      help: '学号必须已存在于系统中',
    },
    {
      key: 'building',
      label: '楼栋',
      required: true,
      type: 'string',
      group: '核心信息',
      description: '目标宿舍楼栋名称',
      help: '楼栋名称必须与系统中已有楼栋精确匹配',
    },
    {
      key: 'roomNo',
      label: '房间号',
      required: true,
      type: 'string',
      group: '核心信息',
      description: '目标宿舍房间号',
      help: '房间号必须在所选楼栋内存在',
    },
    {
      key: 'bedNo',
      label: '床位号',
      required: true,
      type: 'string',
      group: '核心信息',
      description: '目标床位编号',
      help: '床位必须在所选房间内存在且未被占用',
    },
  ],

  // 字段分组（用于 Step3 映射界面展示）
  groups: [{ key: 'core', label: '核心信息', description: '入住必填项' }],

  // 必填字段
  requiredFields: ['studentNo', 'building', 'roomNo', 'bedNo'],

  // 编码类字段（防科学计数法处理）
  codeFields: ['studentNo', 'roomNo', 'bedNo'],

  // 唯一键（用于 C 类冲突校验）
  // 入住场景的冲突有两种：1. 学生已有入住 2. 床位已被占用
  uniqueKeys: ['studentNo'],
  uniqueKeyDescription: '学号（一个学生只能有一个床位）',

  // 冲突处理策略
  strategies: ['SKIP', 'OVERWRITE'],
  strategyDescriptions: {
    SKIP: '跳过冲突行，保留学生当前入住状态',
    OVERWRITE: '覆盖冲突行，先为学生办理退宿再分配新床位',
  },

  // API 端点（V2 增强版）
  api: {
    preview: '/api/v2/occupancy/import/preview',
    execute: '/api/v2/occupancy/import/execute',
  },

  // 导入限制
  limits: {
    maxFileSize: 10 * 1024 * 1024, // 10MB 文件大小上限
    maxRows: 20000, // 前端行数上限
  },

  // 注意事项（用于 Step 1 展示）
  notes: [
    '系统仅支持 <strong>.xls</strong> 和 <strong>.xlsx</strong> 格式。',
    '请勿修改模板中的第一行表头。',
    '<strong>学号、楼栋、房间号、床位号</strong>均为必填项。',
    '学号必须已存在于系统中，否则该行将报错。',
    '楼栋+房间号+床位号必须指向系统中已存在的可用床位。',
    '若学生已有入住记录，将按所选策略（跳过/覆盖）处理。',
    '若目标床位已被其他学生占用，该行将报错。',
  ],
}
