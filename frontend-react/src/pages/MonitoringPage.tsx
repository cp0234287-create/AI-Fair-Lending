import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../lib/api'
import { safeFormatDistance } from '../lib/utils'
import toast from 'react-hot-toast'
import {
  LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer
} from 'recharts'
import {
  Activity, AlertTriangle, CheckCircle, Clock, BarChart3,
  TrendingUp, Loader2, RefreshCw, Bell, BellOff,
  Shield, Database, ShieldAlert, Users
} from 'lucide-react'

function StatCard({ label, value, icon: Icon, color, sub, trend }: {
  label: string; value: string | number; icon: any; color: string; sub?: string; trend?: 'up' | 'down' | 'neutral'
}) {
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</span>
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${color.replace('text-', 'bg-').replace('600', '100').replace('700', '100')}`}>
          <Icon className={`w-5 h-5 ${color}`} />
        </div>
      </div>
      <div className="text-3xl font-bold text-gray-900">{value}</div>
      {sub && <div className="text-xs text-gray-400 mt-1.5">{sub}</div>}
    </div>
  )
}

const scoreColor = (score: number) =>
  score >= 80 ? 'text-green-600 bg-green-50 border-green-200' :
  score >= 60 ? 'text-amber-600 bg-amber-50 border-amber-200' :
  'text-red-600 bg-red-50 border-red-200'

const scoreLabel = (score: number) =>
  score >= 80 ? 'ACCEPTABLE' : score >= 60 ? 'NEEDS ATTENTION' : 'HIGH RISK'

export default function MonitoringPage() {
  const queryClient = useQueryClient()

  const { data, isLoading, refetch } = useQuery<any>({
    queryKey: ['monitoring'],
    queryFn: async () => {
      const base = import.meta.env.VITE_API_URL || ''
      return fetch(`${base}/monitoring/dashboard`).then(r => r.json())
    },
    refetchInterval: 15000,
  })

  // Fetch recent fairness audits from DB
  const { data: recentAudits = [] } = useQuery<any[]>({
    queryKey: ['recent-audits'],
    queryFn: async () => {
      try {
        const res = await api.get('/fairness/recent-audits')
        return res.data?.audits || []
      } catch { return [] }
    },
    refetchInterval: 30000,
  })

  // Fetch datasets
  const { data: datasets = [] } = useQuery<any[]>({
    queryKey: ['all-datasets-mon'],
    queryFn: async () => {
      const res = await api.get('/upload/list')
      return res.data?.uploads || []
    },
    refetchInterval: 30000,
  })

  // Fetch open cases
  const { data: cases = [] } = useQuery<any[]>({
    queryKey: ['cases-monitor'],
    queryFn: async () => {
      try {
        const res = await api.get('/cases')
        return res.data || []
      } catch { return [] }
    },
    refetchInterval: 30000,
  })

  const resolveMutation = useMutation({
    mutationFn: async (alertId: string) => {
      const base = import.meta.env.VITE_API_URL || ''
      return fetch(`${base}/monitoring/alerts/${alertId}/resolve`, { method: 'POST' }).then(r => r.json())
    },
    onSuccess: () => {
      toast.success('Alert resolved')
      queryClient.invalidateQueries({ queryKey: ['monitoring'] })
    },
  })

  const openAlerts = (data?.recent_alerts || []).filter((a: any) => !a.resolved)
  const fairnessAlerts = openAlerts.filter((a: any) => a.alert_type === 'bias')

  // Chart data
  const fairnessTrend = (data?.fairness_score_trend || []).slice(-14).map((f: any) => ({
    date: new Date(f.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    score: Math.round(f.score * 10) / 10,
  }))

  const queryVolumeData = Object.entries(data?.query_volume_by_hour || {})
    .slice(-12)
    .map(([key, count]) => ({
      hour: key.split(' ')[1] + ':00',
      count: count as number,
    }))

  // Computed stats
  const completedDatasets = datasets.filter((d: any) => d.status === 'completed')
  const avgScore = data?.average_fairness_score
  const openCases = cases.filter((c: any) => c.status === 'open' || c.status === 'investigating')
  const criticalCases = cases.filter((c: any) => c.severity === 'critical')

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Platform Monitoring</h1>
          <p className="text-gray-500 mt-1 text-sm">Real-time compliance health, audit history, and system alerts</p>
        </div>
        <button onClick={() => refetch()} className="btn-secondary flex items-center gap-2 text-sm">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
        </div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Datasets Uploaded" value={completedDatasets.length}
              icon={Database} color="text-blue-600"
              sub={`${datasets.filter((d:any) => d.status === 'processing').length} processing`} />
            <StatCard
              label="Avg Fairness Score"
              value={avgScore != null ? avgScore.toFixed(1) : '—'}
              icon={Shield}
              color={avgScore == null ? 'text-gray-400' : avgScore >= 80 ? 'text-green-600' : avgScore >= 60 ? 'text-amber-600' : 'text-red-600'}
              sub={avgScore != null ? scoreLabel(avgScore) : 'No audits yet'}
            />
            <StatCard label="Open Cases" value={openCases.length}
              icon={ShieldAlert} color={openCases.length > 0 ? 'text-red-600' : 'text-green-600'}
              sub={criticalCases.length > 0 ? `${criticalCases.length} critical` : 'No critical cases'} />
            <StatCard label="Total Queries" value={data?.total_queries ?? 0}
              icon={BarChart3} color="text-purple-600"
              sub="AI assistant & search" />
          </div>

          {/* System status banner */}
          <div className={`card p-4 flex items-center gap-3 ${
            data?.system_status === 'healthy' ? 'border-green-200 bg-green-50' :
            data?.system_status === 'critical' ? 'border-red-200 bg-red-50' :
            'border-amber-200 bg-amber-50'
          }`}>
            {data?.system_status === 'healthy'
              ? <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
              : <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0" />}
            <div>
              <span className={`font-semibold text-sm ${data?.system_status === 'healthy' ? 'text-green-800' : data?.system_status === 'critical' ? 'text-red-800' : 'text-amber-800'}`}>
                System Status: {(data?.system_status || 'healthy').toUpperCase()}
              </span>
              <span className="text-xs text-gray-500 ml-3">
                {openAlerts.length === 0 ? 'No open compliance alerts' : `${openAlerts.length} alert(s) require attention`}
              </span>
            </div>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="card p-5">
              <h3 className="font-semibold text-gray-800 mb-1">Fairness Score Trend</h3>
              <p className="text-xs text-gray-500 mb-4">Score per audit run — target ≥ 80 (green zone)</p>
              {fairnessTrend.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={fairnessTrend}>
                    <defs>
                      <linearGradient id="scoreGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#22c55e" stopOpacity={0.1} />
                        <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} tickFormatter={v => `${v}`} />
                    <Tooltip formatter={(v: number) => [`${v.toFixed(1)}/100`, 'Fairness Score']} />
                    <Line type="monotone" dataKey="score" stroke="#22c55e" strokeWidth={2.5} dot={{ r: 4, fill: '#22c55e' }}
                      activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
                  No fairness audits yet — run an audit to see trend data
                </div>
              )}
            </div>

            <div className="card p-5">
              <h3 className="font-semibold text-gray-800 mb-1">Query Volume (Last 12h)</h3>
              <p className="text-xs text-gray-500 mb-4">AI assistant and semantic search usage by hour</p>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={queryVolumeData}>
                  <defs>
                    <linearGradient id="qGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#1a237e" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#1a237e" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="hour" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Area type="monotone" dataKey="count" stroke="#1a237e" fill="url(#qGradient)" strokeWidth={2} name="Queries" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Recent Audits Table */}
          <div className="card overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                <Shield className="w-4 h-4 text-blue-500" /> Recent Fairness Audits
              </h3>
              <span className="text-xs text-gray-400">Auto-refreshes every 30s</span>
            </div>
            {recentAudits.length > 0 ? (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Dataset</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Score</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Status</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Race DI</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Gender DI</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Ran</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {recentAudits.slice(0, 10).map((audit: any, i: number) => {
                    const score = audit.fairness_score ?? 0
                    const raceDI = audit.disparate_impact_ratios?.race
                    const genderDI = audit.disparate_impact_ratios?.gender
                    return (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-gray-700 font-medium truncate max-w-32">
                          {audit.dataset_filename || 'Unknown dataset'}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold border ${scoreColor(score)}`}>
                            {score.toFixed(1)}/100
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-xs font-semibold ${score >= 80 ? 'text-green-600' : score >= 60 ? 'text-amber-600' : 'text-red-600'}`}>
                            {scoreLabel(score)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {raceDI != null ? (
                            <span className={`text-xs font-medium ${raceDI >= 0.8 ? 'text-green-600' : 'text-red-600'}`}>
                              {raceDI.toFixed(3)} {raceDI >= 0.8 ? '✓' : '✗'}
                            </span>
                          ) : <span className="text-gray-400 text-xs">—</span>}
                        </td>
                        <td className="px-4 py-3">
                          {genderDI != null ? (
                            <span className={`text-xs font-medium ${genderDI >= 0.8 ? 'text-green-600' : 'text-red-600'}`}>
                              {genderDI.toFixed(3)} {genderDI >= 0.8 ? '✓' : '✗'}
                            </span>
                          ) : <span className="text-gray-400 text-xs">—</span>}
                        </td>
                        <td className="px-4 py-3 text-gray-400 text-xs">{safeFormatDistance(audit.created_at)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            ) : (
              <div className="p-8 text-center text-gray-400">
                <Shield className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p>No audits yet — run a Fairness Audit to see results here</p>
              </div>
            )}
          </div>

          {/* Datasets Overview */}
          {completedDatasets.length > 0 && (
            <div className="card overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-200">
                <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                  <Database className="w-4 h-4 text-blue-500" /> Dataset Overview ({completedDatasets.length} ready)
                </h3>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">File</th>
                    <th className="text-right px-4 py-3 font-semibold text-gray-600">Records</th>
                    <th className="text-right px-4 py-3 font-semibold text-gray-600">Quality</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Type</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Uploaded</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {completedDatasets.slice(0, 8).map((d: any, i: number) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-800 truncate max-w-40">{d.filename}</td>
                      <td className="px-4 py-3 text-right text-gray-600">{(d.total_rows || 0).toLocaleString()}</td>
                      <td className="px-4 py-3 text-right">
                        {d.quality_score != null ? (
                          <span className={`font-semibold text-xs ${d.quality_score >= 90 ? 'text-green-600' : d.quality_score >= 70 ? 'text-amber-600' : 'text-red-600'}`}>
                            {d.quality_score.toFixed(0)}%
                          </span>
                        ) : '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-xs">{d.dataset_type || '—'}</td>
                      <td className="px-4 py-3 text-gray-400 text-xs">{safeFormatDistance(d.uploaded_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Open Cases */}
          {openCases.length > 0 && (
            <div className="card overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
                <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-red-500" /> Open Compliance Cases ({openCases.length})
                </h3>
                <a href="/cases" className="text-xs text-blue-600 hover:underline">View all →</a>
              </div>
              <div className="divide-y divide-gray-100">
                {openCases.slice(0, 5).map((c: any, i: number) => (
                  <div key={i} className="px-5 py-3 flex items-center justify-between hover:bg-gray-50">
                    <div className="flex items-center gap-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${
                        c.severity === 'critical' ? 'bg-red-100 text-red-700 border-red-200' :
                        c.severity === 'high' ? 'bg-orange-100 text-orange-700 border-orange-200' :
                        'bg-amber-100 text-amber-700 border-amber-200'
                      }`}>{c.severity}</span>
                      <span className="text-sm text-gray-800 font-medium truncate max-w-xs">{c.title}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        c.status === 'open' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                      }`}>{c.status}</span>
                      <span className="text-xs text-gray-400">{safeFormatDistance(c.created_at)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Compliance Alerts */}
          <div>
            <h2 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
              <Bell className="w-5 h-5 text-gray-500" />
              Compliance Alerts
              {openAlerts.length > 0 && (
                <span className="ml-1 bg-red-100 text-red-700 text-xs font-bold px-2 py-0.5 rounded-full">{openAlerts.length} open</span>
              )}
            </h2>
            {openAlerts.length === 0 ? (
              <div className="card p-8 text-center border-green-200 bg-green-50">
                <CheckCircle className="w-10 h-10 text-green-400 mx-auto mb-3" />
                <p className="font-semibold text-green-700">No open alerts — all systems normal</p>
                <p className="text-xs text-gray-500 mt-1">Alerts are triggered when fairness scores drop below thresholds or system anomalies are detected</p>
              </div>
            ) : (
              <div className="space-y-2">
                {openAlerts.map((alert: any) => (
                  <div key={alert.id || alert.alert_id} className={`card p-4 border ${
                    alert.severity === 'critical' ? 'border-red-200 bg-red-50' :
                    alert.severity === 'warning' ? 'border-amber-200 bg-amber-50' : 'border-blue-200 bg-blue-50'
                  }`}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <AlertTriangle className={`w-5 h-5 mt-0.5 flex-shrink-0 ${
                          alert.severity === 'critical' ? 'text-red-600' : 'text-amber-600'
                        }`} />
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-bold border ${
                              alert.severity === 'critical' ? 'bg-red-100 text-red-700 border-red-200' :
                              'bg-amber-100 text-amber-700 border-amber-200'
                            }`}>{alert.severity?.toUpperCase()}</span>
                            <span className="text-xs text-gray-500 capitalize">{(alert.type || alert.alert_type)?.replace(/_/g, ' ')}</span>
                          </div>
                          <p className="text-sm font-medium text-gray-800">{alert.message}</p>
                          <div className="flex items-center gap-1 text-xs text-gray-400 mt-1">
                            <Clock className="w-3 h-3" />
                            {safeFormatDistance(alert.created_at || alert.timestamp)}
                          </div>
                        </div>
                      </div>
                      <button onClick={() => resolveMutation.mutate(alert.alert_id || alert.id)}
                        disabled={resolveMutation.isPending}
                        className="btn-secondary text-xs py-1.5 px-3 flex-shrink-0 flex items-center gap-1">
                        <CheckCircle className="w-3.5 h-3.5" /> Resolve
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
