import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Plus,
  Edit2,
  Trash2,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  X,
  School,
  Search,
  UserPlus,
  UserMinus,
  BookPlus,
  BookMinus,
  Users,
  BookOpen,
  User,
  Loader2,
  Activity,
  BarChart3,
  ChartNoAxesCombined,
  Clock3,
  TrendingUp,
} from 'lucide-react';
import { apiClient, DefaultApi, Configuration } from '../../api';
import type {
  ClassResponse,
  CreateClassRequest,
  UpdateClassRequest,
  ClassMemberResponse,
  AddClassMemberRequest,
  CourseResponse,
  UserPublicResponse,
} from '../../api/generated/models';
import { toast } from '../../components/ui';

const api = new DefaultApi(new Configuration(), '', apiClient);

const DEMO_CLASS_OPERATIONS = [
  { name: 'CS61B-01', course: '数据结构与算法', students: 126, active: 86, progress: 72, score: 74.2, trend: '+8.4%' },
  { name: 'CS61A-02', course: '程序设计方法', students: 98, active: 72, progress: 64, score: 78.6, trend: '+5.1%' },
  { name: 'CSAPP-01', course: '计算机系统导论', students: 84, active: 51, progress: 51, score: 69.8, trend: '-2.3%' },
  { name: 'N2T-01', course: '从零构建计算机', students: 66, active: 43, progress: 46, score: 72.4, trend: '+3.8%' },
];

const ClassOperationsSnapshot: React.FC = () => (
  <section className="rounded-2xl border border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900">
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-gray-100 px-6 py-5 dark:border-gray-800">
      <div><div className="flex items-center gap-2"><h2 className="text-lg font-bold text-gray-900 dark:text-white">班级运行概览</h2><span className="rounded-md bg-brand-50 px-2 py-1 text-xs font-semibold text-brand-700 dark:bg-brand-950/30 dark:text-brand-300">演示数据</span></div><p className="mt-1 text-sm text-gray-500 dark:text-gray-400">快速查看不同教学班的参与、进度和任务表现</p></div>
      <div className="flex items-center gap-2 text-sm font-medium text-gray-500 dark:text-gray-400"><BarChart3 size={17} className="text-brand-500" />5 门课程 · 7 个教学班</div>
    </div>
    <div className="grid gap-4 border-b border-gray-100 p-5 sm:grid-cols-2 xl:grid-cols-4 dark:border-gray-800">
      <ClassMetric icon={Users} label="在学学生" value="486" note="覆盖已开设教学班" />
      <ClassMetric icon={Activity} label="今日活跃" value="318" note="65.4% 学生产生学习行为" />
      <ClassMetric icon={Clock3} label="人均学习" value="5h 18m" note="近 7 天有效学习时长" />
      <ClassMetric icon={TrendingUp} label="平均完成度" value="68.7%" note="较上周增长 6.2%" />
    </div>
    <div className="grid gap-6 p-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(260px,0.8fr)]">
      <div className="overflow-x-auto"><table className="w-full min-w-[650px] text-left text-sm"><thead className="bg-gray-50 text-xs font-semibold text-gray-500 dark:bg-gray-950/40 dark:text-gray-400"><tr><th className="px-4 py-3">班级 / 课程</th><th className="px-3 py-3">学生数</th><th className="px-3 py-3">今日活跃</th><th className="px-3 py-3">课程进度</th><th className="px-3 py-3">作业均分</th><th className="px-4 py-3 text-right">趋势</th></tr></thead><tbody className="divide-y divide-gray-100 dark:divide-gray-800">{DEMO_CLASS_OPERATIONS.map((item) => <tr key={item.name} className="hover:bg-gray-50/70 dark:hover:bg-gray-800/40"><td className="px-4 py-3.5"><p className="font-semibold text-gray-900 dark:text-white">{item.name}</p><p className="mt-0.5 text-xs text-gray-500">{item.course}</p></td><td className="px-3 py-3.5 font-medium text-gray-700 dark:text-gray-300">{item.students}</td><td className="px-3 py-3.5"><span className="font-semibold text-gray-800 dark:text-gray-200">{item.active}</span><span className="ml-1 text-xs text-gray-400">{Math.round(item.active / item.students * 100)}%</span></td><td className="px-3 py-3.5"><div className="flex items-center gap-2"><div className="h-2 w-16 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800"><div className="h-full bg-brand-500" style={{ width: `${item.progress}%` }} /></div><span className="text-xs font-semibold text-gray-600 dark:text-gray-300">{item.progress}%</span></div></td><td className="px-3 py-3.5 font-semibold text-gray-700 dark:text-gray-300">{item.score}</td><td className={`px-4 py-3.5 text-right font-semibold ${item.trend.startsWith('-') ? 'text-rose-600' : 'text-emerald-600'}`}>{item.trend}</td></tr>)}</tbody></table></div>
      <div className="border-t border-gray-100 pt-5 xl:border-l xl:border-t-0 xl:pl-6 xl:pt-0 dark:border-gray-800"><div className="flex items-center justify-between"><div><p className="font-semibold text-gray-900 dark:text-white">本周学习活跃分布</p><p className="mt-1 text-xs text-gray-500">各教学班发生有效学习行为的学生数</p></div><ChartNoAxesCombined size={20} className="text-brand-500" /></div><svg viewBox="0 0 300 115" className="mt-4 h-32 w-full" role="img" aria-label="班级学习活跃趋势图"><path d="M0 98 L0 74 L42 61 L84 67 L126 38 L168 48 L210 23 L252 37 L300 12 L300 98 Z" fill="rgba(59,130,246,0.12)" /><path d="M0 74 L42 61 L84 67 L126 38 L168 48 L210 23 L252 37 L300 12" fill="none" stroke="rgb(59,130,246)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />{[74, 61, 67, 38, 48, 23, 37, 12].map((y, index) => <circle key={index} cx={index * 42} cy={y} r="4" fill="white" stroke="rgb(59,130,246)" strokeWidth="3" />)}</svg><div className="mt-1 grid grid-cols-3 gap-2 text-center text-xs text-gray-500"><span>周一<br /><strong className="text-gray-900 dark:text-white">184</strong></span><span>周三<br /><strong className="text-gray-900 dark:text-white">266</strong></span><span>周五<br /><strong className="text-gray-900 dark:text-white">318</strong></span></div></div>
    </div>
  </section>
);

const ClassMetric: React.FC<{ icon: React.ElementType; label: string; value: string; note: string }> = ({ icon: Icon, label, value, note }) => (
  <div className="flex items-start gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-950/30 dark:text-brand-300"><Icon size={19} /></span><div><p className="text-xl font-bold tabular-nums text-gray-950 dark:text-white">{value}</p><p className="mt-0.5 text-sm font-medium text-gray-700 dark:text-gray-300">{label}</p><p className="mt-0.5 text-xs text-gray-400">{note}</p></div></div>
);

// ============ 班级表单弹窗 ============

interface ClassFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  classInfo?: ClassResponse | null;
}

const ClassFormModal: React.FC<ClassFormModalProps> = ({ isOpen, onClose, onSuccess, classInfo }) => {
  const isEdit = !!classInfo;
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({ className: '', description: '' });

  useEffect(() => {
    if (classInfo) {
      setFormData({ className: classInfo.className || '', description: classInfo.description || '' });
    } else {
      setFormData({ className: '', description: '' });
    }
  }, [classInfo, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.className.trim()) { toast.warning('请输入班级名称'); return; }
    setLoading(true);
    try {
      if (isEdit && classInfo?.id) {
        const req: UpdateClassRequest = { className: formData.className, description: formData.description || undefined };
        const res = await api.updateClass({ classId: classInfo.id as unknown as number, updateClassRequest: req });
        if (res.data.code === 0) { toast.success('更新成功'); onSuccess(); onClose(); }
        else toast.error(res.data.message || '更新失败');
      } else {
        const req: CreateClassRequest = { className: formData.className, description: formData.description || undefined };
        const res = await api.createClass({ createClassRequest: req });
        if (res.data.code === 0) { toast.success('创建成功'); onSuccess(); onClose(); }
        else toast.error(res.data.message || '创建失败');
      }
    } catch (error: any) {
      toast.error(error?.response?.data?.message || '操作失败');
    } finally { setLoading(false); }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">{isEdit ? '编辑班级' : '新建班级'}</h3>
          <button onClick={onClose} aria-label="关闭" className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">班级名称 *</label>
            <input type="text" value={formData.className}
              onChange={(e) => setFormData(prev => ({ ...prev, className: e.target.value }))}
              className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all"
              placeholder="请输入班级名称" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">班级描述</label>
            <textarea value={formData.description} rows={3}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all resize-none"
              placeholder="班级描述信息" />
          </div>
        </form>
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/50">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">取消</button>
          <button onClick={handleSubmit} disabled={loading}
            className="px-6 py-2 bg-brand-600 text-white text-sm font-bold rounded-xl hover:bg-brand-700 shadow-lg shadow-brand-600/20 disabled:opacity-50 transition-all active:scale-95 flex items-center gap-2">
            {loading && <Loader2 size={16} className="animate-spin" />}
            {isEdit ? '保存修改' : '创建班级'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ============ 班级详情弹窗 ============

interface ClassDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  classInfo: ClassResponse | null;
  onRefreshList: () => void;
}

const ClassDetailModal: React.FC<ClassDetailModalProps> = ({ isOpen, onClose, classInfo }) => {
  const [activeTab, setActiveTab] = useState<'members' | 'courses'>('members');

  // 成员管理
  const [members, setMembers] = useState<ClassMemberResponse[]>([]);
  const [memberLoading, setMemberLoading] = useState(false);
  const [memberPage, setMemberPage] = useState(1);
  const [memberTotal, setMemberTotal] = useState(0);
  const [addMemberUserId, setAddMemberUserId] = useState('');
  const [addMemberRole, setAddMemberRole] = useState('STUDENT');

  // 课程管理
  const [courses, setCourses] = useState<CourseResponse[]>([]);
  const [courseLoading, setCourseLoading] = useState(false);
  const [addCourseId, setAddCourseId] = useState('');

  const memberPageSize = 10;

  const fetchMembers = useCallback(async () => {
    if (!classInfo?.id) return;
    setMemberLoading(true);
    try {
      const res = await api.getClassMembers({ classId: classInfo.id as unknown as number, pageNum: memberPage, pageSize: memberPageSize });
      if (res.data.code === 0) {
        const pageData = res.data.data;
        setMembers(pageData?.list || []);
        setMemberTotal(pageData?.total || 0);
      }
    } catch { /* ignore */ }
    finally { setMemberLoading(false); }
  }, [classInfo?.id, memberPage]);

  const fetchCourses = useCallback(async () => {
    if (!classInfo?.id) return;
    setCourseLoading(true);
    try {
      // 使用 apiClient 直接调用（后端有 getClassCourses 但未在 OpenAPI 中暴露）
      // 暂时通过课程列表展示，后续可优化
      const res = await api.listCourses({ page: 1, size: 100 });
      if (res.data.code === 0) setCourses(res.data.data || []);
    } catch { /* ignore */ }
    finally { setCourseLoading(false); }
  }, [classInfo?.id]);

  useEffect(() => {
    if (isOpen && classInfo) {
      setMemberPage(1);
      setActiveTab('members');
    }
  }, [isOpen, classInfo]);

  useEffect(() => { if (isOpen && activeTab === 'members') fetchMembers(); }, [fetchMembers, isOpen, activeTab]);
  useEffect(() => { if (isOpen && activeTab === 'courses') fetchCourses(); }, [fetchCourses, isOpen, activeTab]);

  const handleAddMember = async () => {
    if (!classInfo?.id || !addMemberUserId.trim()) { toast.warning('请输入用户ID'); return; }
    try {
      const req: AddClassMemberRequest = { userId: addMemberUserId as unknown as number, role: addMemberRole };
      const res = await api.addMember({ classId: classInfo.id as unknown as number, addClassMemberRequest: req });
      if (res.data.code === 0) { toast.success('添加成功'); setAddMemberUserId(''); fetchMembers(); }
      else toast.error(res.data.message || '添加失败');
    } catch (error: any) { toast.error(error?.response?.data?.message || '操作失败'); }
  };

  const handleRemoveMember = async (userId?: string) => {
    if (!classInfo?.id || !userId) return;
    if (!window.confirm('确定要移除该成员吗？')) return;
    try {
      const res = await api.removeMember1({ classId: classInfo.id as unknown as number, userId: userId as unknown as number });
      if (res.data.code === 0) { toast.success('移除成功'); fetchMembers(); }
      else toast.error(res.data.message || '移除失败');
    } catch (error: any) { toast.error(error?.response?.data?.message || '操作失败'); }
  };

  const handleAddCourse = async () => {
    if (!classInfo?.id || !addCourseId.trim()) { toast.warning('请输入课程ID'); return; }
    try {
      const res = await api.addCourse({ classId: classInfo.id as unknown as number, addClassCourseRequest: { courseId: addCourseId as unknown as number } });
      if (res.data.code === 0) { toast.success('关联成功'); setAddCourseId(''); }
      else toast.error(res.data.message || '关联失败');
    } catch (error: any) { toast.error(error?.response?.data?.message || '操作失败'); }
  };

  const handleRemoveCourse = async (courseId?: number) => {
    if (!classInfo?.id || !courseId) return;
    if (!window.confirm('确定要移除该课程关联吗？')) return;
    try {
      const res = await api.removeCourse({ classId: classInfo.id as unknown as number, courseId: courseId as unknown as number });
      if (res.data.code === 0) { toast.success('移除成功'); }
      else toast.error(res.data.message || '移除失败');
    } catch (error: any) { toast.error(error?.response?.data?.message || '操作失败'); }
  };

  if (!isOpen || !classInfo) return null;

  const tabClasses = (active: boolean) =>
    `px-4 py-2 text-sm font-bold rounded-lg transition-all ${active
      ? 'bg-brand-600 text-white shadow-md shadow-brand-600/20'
      : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-3xl mx-4 overflow-hidden animate-in zoom-in-95 duration-200 max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800">
          <div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">{classInfo.className}</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{classInfo.description || '暂无描述'}</p>
          </div>
          <button onClick={onClose} aria-label="关闭" className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"><X size={20} /></button>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-2 px-6 pt-4">
          <button onClick={() => setActiveTab('members')} className={tabClasses(activeTab === 'members')}>
            <span className="flex items-center gap-1.5"><Users size={14} /> 成员管理</span>
          </button>
          <button onClick={() => setActiveTab('courses')} className={tabClasses(activeTab === 'courses')}>
            <span className="flex items-center gap-1.5"><BookOpen size={14} /> 班级课程</span>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* 成员管理 */}
          {activeTab === 'members' && (
            <div className="space-y-4">
              {/* 添加成员 */}
              <div className="flex items-end gap-3 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-800">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">用户ID</label>
                  <input type="text" value={addMemberUserId}
                    onChange={(e) => setAddMemberUserId(e.target.value)}
                    className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all"
                    placeholder="输入用户ID" />
                </div>
                <div className="w-32">
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">角色</label>
                  <select value={addMemberRole} onChange={(e) => setAddMemberRole(e.target.value)}
                    className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all cursor-pointer">
                    <option value="STUDENT">学生</option>
                    <option value="TEACHER">教师</option>
                  </select>
                </div>
                <button onClick={handleAddMember}
                  className="px-4 py-2 bg-brand-600 text-white text-sm font-bold rounded-lg hover:bg-brand-700 transition-all active:scale-95 flex items-center gap-1.5 flex-shrink-0">
                  <UserPlus size={16} /> 添加
                </button>
              </div>

              {/* 成员列表 */}
              <div className="border border-gray-100 dark:border-gray-800 rounded-xl overflow-hidden">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-gray-50/50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800">
                      <th className="px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">用户ID</th>
                      <th className="px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">角色</th>
                      <th className="px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">加入时间</th>
                      <th className="px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                    {memberLoading ? (
                      <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400">加载中...</td></tr>
                    ) : members.length > 0 ? (
                      members.map((m) => (
                        <tr key={String(m.id)} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors">
                          <td className="px-4 py-3 text-sm text-gray-900 dark:text-white font-mono">{m.userId ? String(m.userId) : '-'}</td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-0.5 rounded-lg text-xs font-bold border ${
                              m.role === 'TEACHER'
                                ? 'bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-400 border-brand-200 dark:border-brand-800'
                                : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400 border-gray-200 dark:border-gray-700'
                            }`}>{m.role || 'STUDENT'}</span>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">{m.joinTime ? new Date(m.joinTime).toLocaleDateString() : '-'}</td>
                          <td className="px-4 py-3">
                            <button onClick={() => handleRemoveMember(m.userId)}
                              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all" title="移除">
                              <UserMinus size={16} />
                            </button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400">暂无成员</td></tr>
                    )}
                  </tbody>
                </table>
                {/* 成员分页 */}
                {memberTotal > memberPageSize && (
                  <div className="px-4 py-3 bg-gray-50/50 dark:bg-gray-800/50 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between">
                    <span className="text-xs text-gray-500">共 {memberTotal} 条</span>
                    <div className="flex items-center gap-1">
                      <button disabled={memberPage === 1} onClick={() => setMemberPage(p => p - 1)}
                        className="p-1.5 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-500 disabled:opacity-50 transition-all">
                        <ChevronLeft size={14} />
                      </button>
                      <span className="text-xs text-gray-500 px-2">{memberPage}</span>
                      <button disabled={memberPage * memberPageSize >= memberTotal} onClick={() => setMemberPage(p => p + 1)}
                        className="p-1.5 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-500 disabled:opacity-50 transition-all">
                        <ChevronRight size={14} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 班级课程 */}
          {activeTab === 'courses' && (
            <div className="space-y-4">
              {/* 添加课程 */}
              <div className="flex items-end gap-3 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-800">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">课程ID</label>
                  <input type="text" value={addCourseId}
                    onChange={(e) => setAddCourseId(e.target.value)}
                    className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all"
                    placeholder="输入课程ID" />
                </div>
                <button onClick={handleAddCourse}
                  className="px-4 py-2 bg-brand-600 text-white text-sm font-bold rounded-lg hover:bg-brand-700 transition-all active:scale-95 flex items-center gap-1.5 flex-shrink-0">
                  <BookPlus size={16} /> 关联
                </button>
              </div>

              {/* 可选课程列表（参考） */}
              <div className="border border-gray-100 dark:border-gray-800 rounded-xl overflow-hidden">
                <div className="px-4 py-3 bg-gray-50/50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800">
                  <p className="text-xs font-medium text-gray-400">平台课程列表（复制课程ID进行关联）</p>
                </div>
                <div className="max-h-[300px] overflow-y-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-gray-100 dark:border-gray-800">
                        <th className="px-4 py-2 text-xs font-bold text-gray-400 uppercase tracking-wider">课程ID</th>
                        <th className="px-4 py-2 text-xs font-bold text-gray-400 uppercase tracking-wider">课程名称</th>
                        <th className="px-4 py-2 text-xs font-bold text-gray-400 uppercase tracking-wider">状态</th>
                        <th className="px-4 py-2 text-xs font-bold text-gray-400 uppercase tracking-wider">操作</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                      {courseLoading ? (
                        <tr><td colSpan={4} className="px-4 py-6 text-center text-gray-400">加载中...</td></tr>
                      ) : courses.length > 0 ? (
                        courses.map((c) => (
                          <tr key={String(c.id)} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors">
                            <td className="px-4 py-2 text-xs text-gray-500 font-mono">{String(c.id)}</td>
                            <td className="px-4 py-2 text-sm text-gray-900 dark:text-white">{c.title}</td>
                            <td className="px-4 py-2">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                c.status === 1 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
                              }`}>{c.status === 1 ? '已发布' : c.status === 2 ? '已下架' : '未发布'}</span>
                            </td>
                            <td className="px-4 py-2 flex items-center gap-1">
                              <button onClick={() => { setAddCourseId(String(c.id)); handleAddCourse(); }}
                                className="p-1 text-gray-400 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-900/20 rounded transition-all" title="关联到班级">
                                <BookPlus size={14} />
                              </button>
                              <button onClick={() => handleRemoveCourse(c.id)}
                                className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-all" title="取消关联">
                                <BookMinus size={14} />
                              </button>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr><td colSpan={4} className="px-4 py-6 text-center text-gray-400">暂无课程</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ============ 班级管理主页面 ============

export const ClassManagementPage: React.FC = () => {
  const [classes, setClasses] = useState<ClassResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [keyword, setKeyword] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingClass, setEditingClass] = useState<ClassResponse | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [detailClass, setDetailClass] = useState<ClassResponse | null>(null);
  // 用户信息缓存（参考教师管理页面）
  const [userMap, setUserMap] = useState<Record<string, UserPublicResponse>>({});
  const userMapRef = useRef(userMap);
  userMapRef.current = userMap;

  const fetchUserInfos = useCallback(async (userIds: (number | string | undefined)[]) => {
    const ids = userIds.filter((id): id is number | string => id != null);
    const uniqueIds = [...new Set(ids.map(id => String(id)))].filter(id => !userMapRef.current[id]);
    if (uniqueIds.length === 0) return;
    const results = await Promise.allSettled(
      uniqueIds.map(id => api.getUserPublicInfo({ id: id as unknown as number }))
    );
    const newMap: Record<string, UserPublicResponse> = {};
    results.forEach((r, i) => {
      if (r.status === 'fulfilled' && r.value.data.code === 0 && r.value.data.data) {
        newMap[uniqueIds[i]] = r.value.data.data;
      }
    });
    if (Object.keys(newMap).length > 0) {
      setUserMap(prev => ({ ...prev, ...newMap }));
    }
  }, []);

  const pageSize = 10;

  const fetchClasses = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.listClasses({ pageNum: page, pageSize, keyword: keyword || undefined });
      if (res.data.code === 0) {
        const pageData = res.data.data;
        const list = pageData?.list || [];
        setClasses(list);
        setTotal(pageData?.total || 0);
        fetchUserInfos(list.map(c => c.creatorId));
      } else {
        toast.error(res.data.message || '获取班级列表失败');
      }
    } catch (error: any) {
      toast.error(error?.response?.data?.message || '网络错误');
    } finally { setLoading(false); }
  }, [page, keyword, fetchUserInfos]);

  useEffect(() => { fetchClasses(); }, [fetchClasses]);

  const handleDelete = async (cls: ClassResponse) => {
    if (!cls.id) return;
    if (!window.confirm(`确定要删除班级 "${cls.className}" 吗？`)) return;
    try {
      const res = await api.deleteClass({ classId: cls.id as unknown as number });
      if (res.data.code === 0) { toast.success('删除成功'); fetchClasses(); }
      else toast.error(res.data.message || '删除失败');
    } catch (error: any) { toast.error(error?.response?.data?.message || '网络错误'); }
  };

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">班级管理</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">管理班级信息、成员和关联课程</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => { setEditingClass(null); setModalOpen(true); }}
            className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-xl text-sm font-bold hover:bg-brand-700 shadow-lg shadow-brand-600/20 transition-all active:scale-95">
            <Plus size={18} />
            <span>新建班级</span>
          </button>
        </div>
      </div>

      <ClassOperationsSnapshot />

      {/* Filter */}
      <div className="bg-white dark:bg-gray-900 p-4 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm transition-all duration-300">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1 relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-brand-500 transition-colors" size={20} />
            <input type="text" value={keyword}
              onChange={(e) => { setKeyword(e.target.value); setPage(1); }}
              placeholder="搜索班级名称..."
              className="w-full pl-12 pr-4 py-2.5 bg-gray-50 dark:bg-gray-800/50 border border-transparent focus:border-brand-500/50 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 outline-none transition-all" />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={() => fetchClasses()}
              className="p-2.5 bg-gray-50 dark:bg-gray-800/50 hover:bg-brand-50 dark:hover:bg-brand-900/20 text-gray-500 hover:text-brand-600 dark:hover:text-brand-400 rounded-xl transition-all">
              <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden transition-all duration-300">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse admin-table">
            <thead>
              <tr className="bg-gray-50/50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800">
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">班级信息</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">创建者</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">创建时间</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={4} className="px-6 py-8 h-16">
                      <div className="flex gap-4"><div className="w-10 h-10 bg-gray-100 dark:bg-gray-800 rounded-xl" />
                        <div className="space-y-2 flex-1"><div className="h-4 bg-gray-100 dark:bg-gray-800 rounded w-1/4" /><div className="h-3 bg-gray-100 dark:bg-gray-800 rounded w-1/3" /></div>
                      </div>
                    </td>
                  </tr>
                ))
              ) : classes.length > 0 ? (
                classes.map((cls) => (
                  <tr key={String(cls.id)} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 flex items-center justify-center shadow-sm">
                          <School size={20} className="text-brand-500" />
                        </div>
                        <div>
                          <p className="font-bold text-gray-900 dark:text-white group-hover:text-brand-600 transition-colors">{cls.className || '未命名'}</p>
                          {cls.description && <p className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-[250px]">{cls.description}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {cls.creatorId ? (() => {
                        const u = userMap[String(cls.creatorId)];
                        return u ? (
                          <div className="flex items-center gap-2.5">
                            {u.userAvatar ? (
                              <img src={u.userAvatar} alt="" className="w-8 h-8 rounded-lg object-cover border border-gray-100 dark:border-gray-700" />
                            ) : (
                              <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                                <User size={16} className="text-gray-400" />
                              </div>
                            )}
                            <div>
                              <p className="text-sm font-medium text-gray-900 dark:text-white">{u.userName || '未设置'}</p>
                              <p className="text-xs text-gray-400">{u.role === 'admin' ? '管理员' : u.role === 'teacher' ? '教师' : '学生'}</p>
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">加载中...</span>
                        );
                      })() : <span className="text-sm text-gray-400">-</span>}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                      {cls.createTime ? new Date(cls.createTime).toLocaleDateString() : '-'}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <button onClick={() => { setDetailClass(cls); setDetailModalOpen(true); }}
                          className="p-2 text-gray-400 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-900/20 rounded-lg transition-all" title="管理详情">
                          <Users size={18} />
                        </button>
                        <button onClick={() => { setEditingClass(cls); setModalOpen(true); }}
                          className="p-2 text-gray-400 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-900/20 rounded-lg transition-all" title="编辑">
                          <Edit2 size={18} />
                        </button>
                        <button onClick={() => handleDelete(cls)}
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all" title="删除">
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center">
                      <div className="w-16 h-16 bg-gray-50 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4">
                        <School size={32} className="text-gray-300" />
                      </div>
                      <p className="text-gray-500 dark:text-gray-400 font-medium">暂无班级数据</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="px-6 py-4 bg-gray-50/50 dark:bg-gray-800/50 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between transition-colors duration-300">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            共 <span className="font-bold text-gray-900 dark:text-white">{total}</span> 条，第 <span className="font-bold text-gray-900 dark:text-white">{page}</span> / {totalPages || 1} 页
          </p>
          <div className="flex items-center gap-2">
            <button disabled={page === 1 || loading} onClick={() => setPage(p => p - 1)}
              className="p-2 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-500 hover:bg-white dark:hover:bg-gray-800 disabled:opacity-50 transition-all">
              <ChevronLeft size={18} />
            </button>
            {Array.from({ length: Math.min(5, totalPages) }).map((_, i) => (
              <button key={i} onClick={() => setPage(i + 1)}
                className={`w-10 h-10 rounded-lg text-sm font-bold transition-all ${
                  page === i + 1 ? 'bg-brand-600 text-white shadow-lg shadow-brand-600/20' : 'text-gray-500 hover:bg-white dark:hover:bg-gray-800 border border-transparent hover:border-gray-200 dark:hover:border-gray-700'
                }`}>{i + 1}</button>
            ))}
            <button disabled={page >= totalPages || loading} onClick={() => setPage(p => p + 1)}
              className="p-2 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-500 hover:bg-white dark:hover:bg-gray-800 disabled:opacity-50 transition-all">
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* Modals */}
      <ClassFormModal
        isOpen={modalOpen}
        onClose={() => { setModalOpen(false); setEditingClass(null); }}
        onSuccess={fetchClasses}
        classInfo={editingClass}
      />
      <ClassDetailModal
        isOpen={detailModalOpen}
        onClose={() => { setDetailModalOpen(false); setDetailClass(null); }}
        classInfo={detailClass}
        onRefreshList={fetchClasses}
      />
    </div>
  );
};
