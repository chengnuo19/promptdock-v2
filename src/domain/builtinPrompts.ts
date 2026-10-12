import type { PromptFolder, PromptTemplate } from '../types';

const folder = (id: string, name: string): PromptFolder => ({ id, name, createdAt: 0, updatedAt: 0 });

export const BUILTIN_FOLDERS: PromptFolder[] = [
  folder('folder_office', '写作办公'),
  folder('folder_research', '学习科研'),
  folder('folder_modeling', '数学建模'),
  folder('folder_code', '编程开发'),
  folder('folder_analysis', '分析规划'),
];

const prompt = (
  id: string,
  title: string,
  content: string,
  folderId: string,
  tags: string[],
): PromptTemplate => ({ id, title, content, folderId, tags, source: 'builtin', createdAt: 0, updatedAt: 0 });

export const BUILTIN_PROMPTS: PromptTemplate[] = [
  prompt('builtin_translate', '专业翻译', `请将我提供的内容翻译为{{目标语言}}。

要求：忠实保留事实、数字、专有名词、代码和格式；译文符合目标语言的自然表达；有歧义时列出最可能译法并指出歧义，不补造原文没有的信息。

待翻译内容：
{{原文}}`, 'folder_office', ['翻译', '写作', 'language']),
  prompt('builtin_polish', '润色改写', `请润色下面用于{{文本用途}}的文字。

保留原意、事实、数字和结论；删除重复与空话；改善结构、语法和衔接；不要擅自增加证据。先给润色稿，再简要列出关键修改。

原文：
{{原文}}`, 'folder_office', ['润色', '改写', 'writing']),
  prompt('builtin_summary', '长文总结', `请把以下材料整理成一份{{摘要长度}}的准确摘要。

输出：一句话结论、核心要点、关键数字与限制、可执行事项、仍需确认的问题。不得加入材料之外的信息。

材料：
{{材料}}`, 'folder_office', ['总结', '阅读', 'summary']),
  prompt('builtin_email', '邮件草稿', `请为{{收件人}}起草一封邮件，目的为{{邮件目的}}。

语气：{{语气}}。输出邮件主题与正文；开头直接说明来意，行动要求和截止时间清楚，结尾礼貌克制。

必要信息：
{{背景信息}}`, 'folder_office', ['邮件', '办公', 'email']),

  prompt('builtin_explain', '概念讲解', `请面向{{读者水平}}解释“{{概念}}”。

依次给出：简明定义、为什么重要、直观类比、典型例子、常见误区、一道带答案的小练习。术语必须准确。`, 'folder_research', ['学习', '解释', 'education']),
  prompt('builtin_literature', '文献精读', `请围绕{{研究主题}}精读我提供的文献内容。

提取研究问题、数据与方法、核心发现、作者证据、限制、与主题的关系；区分原文事实和你的推断，不得编造引用。

文献内容：
{{文献内容}}`, 'folder_research', ['文献', '科研', 'paper']),
  prompt('builtin_academic_polish', '学术段落润色', `请按{{目标期刊或课程}}的学术表达要求润色以下段落。

保留原有事实、数据、公式含义与结论；提高逻辑连贯性和术语一致性；不得新增不存在的实验或引用。输出润色稿和待作者确认项。

段落：
{{段落}}`, 'folder_research', ['论文', '润色', 'academic']),
  prompt('builtin_research_question', '研究问题设计', `围绕{{研究主题}}设计可检验的研究问题。

说明研究对象、关键变量、可获得数据、假设、识别或验证思路、预期贡献和主要限制。优先给出一个范围可控的主问题，再给两个备选问题。`, 'folder_research', ['科研', '选题', 'research']),

  prompt('builtin_modeling_decompose', '赛题拆解', `请拆解下面的数学建模赛题。

识别每个子问题的目标、输入输出、约束、评价指标和相互依赖；区分必须建模的内容与可作合理假设的内容；给出数据需求、验证方法和最小可行求解顺序。

赛题：
{{赛题内容}}`, 'folder_modeling', ['赛题', '建模', 'modeling']),
  prompt('builtin_modeling_data', '数据预处理方案', `请为以下建模数据设计可复现的预处理方案。

数据说明：{{数据说明}}
研究目标：{{研究目标}}

检查缺失、异常、重复、量纲、时间顺序和泄漏风险；逐项说明处理规则、依据、输出字段与验证方式，不要在未看数据时虚构统计结果。`, 'folder_modeling', ['数据', '预处理', 'EDA']),
  prompt('builtin_modeling_select', '模型选择比较', `针对{{问题目标}}比较可行的数学模型。

已知条件：{{已知条件}}

至少比较三种候选方法的适用前提、数据要求、可解释性、计算成本和验证方式；推荐一个主模型和一个基线模型，并说明为什么不选其他方案。`, 'folder_modeling', ['模型选择', '比较', 'modeling']),
  prompt('builtin_modeling_validate', '结果与敏感性分析', `请审查以下模型与结果是否可靠。

模型与结果：
{{模型与结果}}

检查目标函数、约束、单位、数据切分、基线、误差指标和结论是否一致；设计敏感性、稳健性与极端情形测试；明确哪些结论已被证据支持。`, 'folder_modeling', ['验证', '敏感性', 'robustness']),

  prompt('builtin_code_review', '代码审查', `请以资深{{语言或框架}}工程师身份审查下面的代码。

优先找会导致错误行为、数据丢失、安全问题或兼容回归的缺陷；再检查边界条件和缺失测试。每项说明影响、证据和最小修复建议；不要做无关重构。

代码：
{{代码}}`, 'folder_code', ['代码审查', 'code', 'review']),
  prompt('builtin_bug_diagnosis', 'Bug 诊断', `请诊断下面的故障，不要在没有证据时直接猜修复方案。

错误现象：{{错误现象}}
相关代码或日志：{{代码或日志}}

先给可复现条件和排查顺序，再定位最可能的责任层，列出验证每个假设的命令或观察点，最后给最小修复与回归测试。`, 'folder_code', ['调试', 'bug', 'debug']),
  prompt('builtin_implementation_plan', '最小实现计划', `请为{{功能目标}}制定可直接执行的最小实现计划。

现有项目：{{项目背景}}

列出范围边界、受影响组件、数据流、接口变化、失败情形和测试；把任务拆成可独立验证的小步，不增加未要求的抽象或功能。`, 'folder_code', ['实现', '计划', 'code']),
  prompt('builtin_unit_tests', '单元测试设计', `请为{{待测模块}}设计单元测试。

模块行为：{{模块行为}}

覆盖正常路径、边界值、无效输入和已知回归；每个测试写清输入、动作和可观察结果；优先测试行为而非内部调用顺序。`, 'folder_code', ['测试', '单元测试', 'code']),

  prompt('builtin_requirements', '需求澄清', `请把下面的初始需求整理成可执行规格。

初始需求：{{初始需求}}

区分目标、用户、成功标准、范围内外、约束和未知项；只提出会改变方案的关键问题，并给出带取舍的推荐默认值。`, 'folder_analysis', ['需求', '澄清', 'analysis']),
  prompt('builtin_project_breakdown', '项目方案拆解', `请把{{项目目标}}拆成可交付方案。

背景与约束：{{背景与约束}}

给出最小可行版本、组件与依赖、按风险排序的实施阶段、每阶段验收标准和主要阻塞项。确保每一步都能独立验证。`, 'folder_analysis', ['项目', '拆解', 'planning']),
  prompt('builtin_compare', '多方案比较', `请比较以下备选方案：{{备选方案}}。

决策目标：{{决策目标}}

使用一致维度比较效果、成本、风险、复杂度、可逆性和验证难度；给出推荐方案、适用条件以及什么情况下应改选其他方案。`, 'folder_analysis', ['比较', '决策', 'analysis']),
  prompt('builtin_evidence_audit', '资料证据核验', `请核验以下结论是否得到资料支持：{{待核验结论}}。

资料：
{{资料}}

逐条标记“已支持、部分支持、未支持、相互冲突”；引用对应证据位置；分开陈述事实、推断和缺失信息，不把空结果当作验证通过。`, 'folder_analysis', ['核验', '证据', 'audit']),
];

