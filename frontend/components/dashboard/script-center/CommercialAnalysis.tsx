'use client'

/**
 * @file CommercialAnalysis.tsx
 * @description 商业分析组件，提供目标受众分析、市场竞争分析、收益预估、IP价值评估等商业数据
 */

import { useState, useEffect } from 'react'
import {
  TrendingUp,
  Target,
  Users,
  DollarSign,
  Award,
  Share2,
  Lightbulb,
  RefreshCw,
  ChevronDown,
  ChevronRight,
} from 'lucide-react'
import { Button } from '@/components/ui/button'

interface AudienceAnalysis {
  primaryAudience: string[]
  secondaryAudience: string[]
  ageGroups: Array<{ range: string; percentage: number }>
  genderDistribution: { male: number; female: number }
  interests: string[]
}

interface MarketAnalysis {
  marketSize: string
  growthRate: string
  competitionLevel: 'low' | 'medium' | 'high'
  similarWorks: Array<{ title: string; year: number; rating: number }>
  opportunities: string[]
  threats: string[]
}

interface RevenueEstimate {
  conservative: number
  moderate: number
  optimistic: number
  breakdown: {
    boxOffice: number
    streaming: number
    merchandise: number
    licensing: number
  }
}

interface IPValue {
  overallScore: number
  franchisePotential: number
  sequelPotential: number
  merchandisePotential: number
  adaptationPotential: number
  strengths: string[]
  weaknesses: string[]
}

interface DistributionChannel {
  name: string
  suitability: number
  pros: string[]
  cons: string[]
}

interface MarketingStrategy {
  targetPlatforms: string[]
  keySellingPoints: string[]
  recommendedBudget: string
  timeline: string
  tactics: string[]
}

interface CommercialAnalysisData {
  audience: AudienceAnalysis
  market: MarketAnalysis
  revenue: RevenueEstimate
  ipValue: IPValue
  channels: DistributionChannel[]
  marketing: MarketingStrategy
}

interface CommercialAnalysisProps {
  scriptId: string
}

/**
 * CommercialAnalysis - 商业分析组件
 * @param {CommercialAnalysisProps} props - 组件属性
 * @param {string} props.scriptId - 剧本ID
 * @returns {JSX.Element} 渲染的商业分析界面
 */
export function CommercialAnalysis({ scriptId }: CommercialAnalysisProps) {
  const [analysis, setAnalysis] = useState<CommercialAnalysisData | null>(null)
  const [loading, setLoading] = useState(true)
  const [analyzing, setAnalyzing] = useState(false)
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['audience', 'market'])
  )

  useEffect(() => {
    loadAnalysis()
  }, [scriptId])

  const loadAnalysis = async () => {
    setLoading(true)
    try {
      // 模拟API调用
      await new Promise((resolve) => setTimeout(resolve, 500))

      // 模拟数据
      setAnalysis({
        audience: {
          primaryAudience: ['年轻成人', '科幻爱好者', '动作片爱好者'],
          secondaryAudience: ['家庭观众', '情侣观众'],
          ageGroups: [
            { range: '18-24', percentage: 35 },
            { range: '25-34', percentage: 30 },
            { range: '35-44', percentage: 20 },
            { range: '45+', percentage: 15 },
          ],
          genderDistribution: { male: 55, female: 45 },
          interests: ['科幻', '动作', '悬疑', '特效大片'],
        },
        market: {
          marketSize: '50亿人民币',
          growthRate: '12%',
          competitionLevel: 'high',
          similarWorks: [
            { title: '流浪地球', year: 2019, rating: 7.9 },
            { title: '流浪地球2', year: 2023, rating: 8.3 },
            { title: '三体', year: 2023, rating: 8.7 },
          ],
          opportunities: ['国产科幻市场增长迅速', '观众对高质量科幻作品需求增加'],
          threats: ['市场竞争激烈', '制作成本高', '观众期待值高'],
        },
        revenue: {
          conservative: 50000000,
          moderate: 150000000,
          optimistic: 300000000,
          breakdown: {
            boxOffice: 60,
            streaming: 25,
            merchandise: 10,
            licensing: 5,
          },
        },
        ipValue: {
          overallScore: 78,
          franchisePotential: 85,
          sequelPotential: 80,
          merchandisePotential: 65,
          adaptationPotential: 70,
          strengths: ['独特的世界观', '强烈的视觉冲击', '深刻的主题内涵'],
          weaknesses: ['制作难度大', '预算要求高', '市场风险'],
        },
        channels: [
          {
            name: '院线发行',
            suitability: 95,
            pros: ['票房收入高', '品牌影响力大', '市场反响直接'],
            cons: ['竞争激烈', '排片压力大', '上映周期短'],
          },
          {
            name: '流媒体平台',
            suitability: 80,
            pros: ['受众广泛', '长尾效应', '数据反馈及时'],
            cons: ['收入分成低', '盗版风险', '竞争激烈'],
          },
          {
            name: '国际发行',
            suitability: 70,
            pros: ['市场潜力大', '文化输出', '收益多元化'],
            cons: ['文化差异', '发行成本高', '审查风险'],
          },
        ],
        marketing: {
          targetPlatforms: ['微博', '抖音', 'B站', '小红书'],
          keySellingPoints: ['顶级特效', '原创故事', '国际视野', '深度思考'],
          recommendedBudget: '制作预算的30-40%',
          timeline: '上映前6个月启动营销',
          tactics: [
            '预告片病毒式传播',
            'KOL合作推广',
            '线下粉丝活动',
            '周边产品预售',
            '社交媒体话题营销',
          ],
        },
      })
    } catch (error) {
      console.error('Failed to load analysis:', error)
    } finally {
      setLoading(false)
    }
  }

  const runAnalysis = async () => {
    setAnalyzing(true)
    try {
      await new Promise((resolve) => setTimeout(resolve, 2000))
      await loadAnalysis()
    } finally {
      setAnalyzing(false)
    }
  }

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(section)) {
        newSet.delete(section)
      } else {
        newSet.add(section)
      }
      return newSet
    })
  }

  const formatCurrency = (value: number) => {
    if (value >= 100000000) {
      return `${(value / 100000000).toFixed(1)}亿`
    } else if (value >= 10000) {
      return `${(value / 10000).toFixed(0)}万`
    }
    return value.toString()
  }

  if (loading) {
    return (
      <div className="commercial-analysis bg-card rounded-lg border border-border overflow-hidden p-8">
        <div className="text-center text-muted-foreground">加载商业分析数据...</div>
      </div>
    )
  }

  if (!analysis) {
    return (
      <div className="commercial-analysis bg-card rounded-lg border border-border overflow-hidden p-8">
        <div className="text-center text-muted-foreground">
          暂无商业分析数据
          <Button onClick={runAnalysis} className="mt-4">
            生成分析
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="commercial-analysis bg-card rounded-lg border border-border overflow-hidden">
      {/* 标题 */}
      <div className="p-3 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-medium text-foreground">商业分析</h3>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={runAnalysis}
          disabled={analyzing}
          className="h-7"
        >
          <RefreshCw className={`h-3 w-3 mr-1 ${analyzing ? 'animate-spin' : ''}`} />
          {analyzing ? '分析中...' : '重新分析'}
        </Button>
      </div>

      {/* 分析内容 */}
      <div className="divide-y divide-white/5">
        {/* 目标受众分析 */}
        <Section
          title="目标受众分析"
          icon={<Users className="h-4 w-4" />}
          expanded={expandedSections.has('audience')}
          onToggle={() => toggleSection('audience')}
        >
          <div className="space-y-3">
            <div>
              <div className="text-xs text-muted-foreground mb-1">主要受众</div>
              <div className="flex flex-wrap gap-2">
                {analysis.audience.primaryAudience.map((aud, i) => (
                  <span
                    key={i}
                    className="text-xs px-2 py-1 rounded bg-info/20 text-info"
                  >
                    {aud}
                  </span>
                ))}
              </div>
            </div>

            <div>
              <div className="text-xs text-muted-foreground mb-1">年龄段分布</div>
              <div className="space-y-1">
                {analysis.audience.ageGroups.map((group) => (
                  <div key={group.range} className="flex items-center gap-2">
                    <span className="text-xs text-foreground w-16">{group.range}</span>
                    <div className="flex-1 h-2 bg-muted/50 rounded overflow-hidden">
                      <div
                        className="h-full bg-primary"
                        style={{ width: `${group.percentage}%` }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground w-8">{group.percentage}%</span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="text-xs text-muted-foreground mb-1">性别分布</div>
              <div className="flex gap-2">
                <div className="flex-1 p-2 bg-muted/50 rounded">
                  <div className="text-xs text-muted-foreground">男性</div>
                  <div className="text-lg font-bold text-foreground">
                    {analysis.audience.genderDistribution.male}%
                  </div>
                </div>
                <div className="flex-1 p-2 bg-muted/50 rounded">
                  <div className="text-xs text-muted-foreground">女性</div>
                  <div className="text-lg font-bold text-foreground">
                    {analysis.audience.genderDistribution.female}%
                  </div>
                </div>
              </div>
            </div>

            <div>
              <div className="text-xs text-muted-foreground mb-1">兴趣标签</div>
              <div className="flex flex-wrap gap-1">
                {analysis.audience.interests.map((interest, i) => (
                  <span
                    key={i}
                    className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground"
                  >
                    {interest}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </Section>

        {/* 市场竞争分析 */}
        <Section
          title="市场竞争分析"
          icon={<Target className="h-4 w-4" />}
          expanded={expandedSections.has('market')}
          onToggle={() => toggleSection('market')}
        >
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="p-2 bg-muted/50 rounded">
                <div className="text-xs text-muted-foreground">市场规模</div>
                <div className="text-lg font-bold text-foreground">{analysis.market.marketSize}</div>
              </div>
              <div className="p-2 bg-muted/50 rounded">
                <div className="text-xs text-muted-foreground">增长率</div>
                <div className="text-lg font-bold text-primary">{analysis.market.growthRate}</div>
              </div>
            </div>

            <div>
              <div className="text-xs text-muted-foreground mb-1">竞争程度</div>
              <div
                className={`inline-block px-2 py-1 rounded text-xs ${
                  analysis.market.competitionLevel === 'high'
                    ? 'bg-destructive/20 text-destructive'
                    : analysis.market.competitionLevel === 'medium'
                    ? 'bg-chart-5/20 text-chart-5'
                    : 'bg-primary/20 text-primary'
                }`}
              >
                {analysis.market.competitionLevel === 'high'
                  ? '高'
                  : analysis.market.competitionLevel === 'medium'
                  ? '中'
                  : '低'}
              </div>
            </div>

            <div>
              <div className="text-xs text-muted-foreground mb-1">同类作品</div>
              <div className="space-y-1">
                {analysis.market.similarWorks.map((work, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-2 bg-muted/50 rounded"
                  >
                    <span className="text-sm text-foreground">{work.title}</span>
                    <span className="text-xs text-muted-foreground">
                      {work.year} | 评分 {work.rating}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <div className="text-xs text-primary mb-1">机会</div>
                <ul className="text-xs text-foreground space-y-1">
                  {analysis.market.opportunities.map((opp, i) => (
                    <li key={i}>• {opp}</li>
                  ))}
                </ul>
              </div>
              <div>
                <div className="text-xs text-destructive mb-1">威胁</div>
                <ul className="text-xs text-foreground space-y-1">
                  {analysis.market.threats.map((threat, i) => (
                    <li key={i}>• {threat}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </Section>

        {/* 收益预估 */}
        <Section
          title="收益预估模型"
          icon={<DollarSign className="h-4 w-4" />}
          expanded={expandedSections.has('revenue')}
          onToggle={() => toggleSection('revenue')}
        >
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              <div className="p-2 bg-destructive/10 rounded border border-destructive/20">
                <div className="text-xs text-muted-foreground mb-1">保守预估</div>
                <div className="text-lg font-bold text-foreground">
                  {formatCurrency(analysis.revenue.conservative)}
                </div>
              </div>
              <div className="p-2 bg-chart-5/10 rounded border border-chart-5/20">
                <div className="text-xs text-muted-foreground mb-1">中等预估</div>
                <div className="text-lg font-bold text-foreground">
                  {formatCurrency(analysis.revenue.moderate)}
                </div>
              </div>
              <div className="p-2 bg-primary/10 rounded border border-primary/20">
                <div className="text-xs text-muted-foreground mb-1">乐观预估</div>
                <div className="text-lg font-bold text-foreground">
                  {formatCurrency(analysis.revenue.optimistic)}
                </div>
              </div>
            </div>

            <div>
              <div className="text-xs text-muted-foreground mb-1">收入来源分布</div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-foreground w-20">票房收入</span>
                  <div className="flex-1 h-2 bg-muted/50 rounded overflow-hidden">
                    <div
                      className="h-full bg-info"
                      style={{ width: `${analysis.revenue.breakdown.boxOffice}%` }}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground w-8">
                    {analysis.revenue.breakdown.boxOffice}%
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-foreground w-20">流媒体</span>
                  <div className="flex-1 h-2 bg-muted/50 rounded overflow-hidden">
                    <div
                      className="h-full bg-chart-1"
                      style={{ width: `${analysis.revenue.breakdown.streaming}%` }}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground w-8">
                    {analysis.revenue.breakdown.streaming}%
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-foreground w-20">衍生品</span>
                  <div className="flex-1 h-2 bg-muted/50 rounded overflow-hidden">
                    <div
                      className="h-full bg-primary"
                      style={{ width: `${analysis.revenue.breakdown.merchandise}%` }}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground w-8">
                    {analysis.revenue.breakdown.merchandise}%
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-foreground w-20">授权收入</span>
                  <div className="flex-1 h-2 bg-muted/50 rounded overflow-hidden">
                    <div
                      className="h-full bg-chart-5"
                      style={{ width: `${analysis.revenue.breakdown.licensing}%` }}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground w-8">
                    {analysis.revenue.breakdown.licensing}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        </Section>

        {/* IP价值评估 */}
        <Section
          title="IP价值评估"
          icon={<Award className="h-4 w-4" />}
          expanded={expandedSections.has('ipValue')}
          onToggle={() => toggleSection('ipValue')}
        >
          <div className="space-y-3">
            <div className="flex items-center justify-center p-4 bg-muted/50 rounded">
              <div className="text-center">
                <div className="text-3xl font-bold text-foreground mb-1">
                  {analysis.ipValue.overallScore}
                </div>
                <div className="text-xs text-muted-foreground">综合评分</div>
              </div>
            </div>

            <div className="space-y-2">
              <ScoreBar label="系列化潜力" score={analysis.ipValue.franchisePotential} />
              <ScoreBar label="续集潜力" score={analysis.ipValue.sequelPotential} />
              <ScoreBar label="衍生品潜力" score={analysis.ipValue.merchandisePotential} />
              <ScoreBar label="改编潜力" score={analysis.ipValue.adaptationPotential} />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <div className="text-xs text-primary mb-1">优势</div>
                <ul className="text-xs text-foreground space-y-1">
                  {analysis.ipValue.strengths.map((s, i) => (
                    <li key={i}>• {s}</li>
                  ))}
                </ul>
              </div>
              <div>
                <div className="text-xs text-destructive mb-1">劣势</div>
                <ul className="text-xs text-foreground space-y-1">
                  {analysis.ipValue.weaknesses.map((w, i) => (
                    <li key={i}>• {w}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </Section>

        {/* 发行渠道建议 */}
        <Section
          title="发行渠道建议"
          icon={<Share2 className="h-4 w-4" />}
          expanded={expandedSections.has('channels')}
          onToggle={() => toggleSection('channels')}
        >
          <div className="space-y-2">
            {analysis.channels.map((channel, i) => (
              <div key={i} className="p-3 bg-muted/50 rounded border border-border">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-foreground">{channel.name}</span>
                  <div className="flex items-center gap-1">
                    <div className="text-xs text-muted-foreground">适合度</div>
                    <div className="text-sm font-bold text-foreground">{channel.suitability}%</div>
                  </div>
                </div>
                <div className="mb-2 h-1.5 bg-muted/50 rounded overflow-hidden">
                  <div
                    className="h-full bg-primary"
                    style={{ width: `${channel.suitability}%` }}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <div className="text-primary mb-1">优势</div>
                    <ul className="text-foreground space-y-0.5">
                      {channel.pros.map((pro, j) => (
                        <li key={j}>• {pro}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <div className="text-destructive mb-1">劣势</div>
                    <ul className="text-foreground space-y-0.5">
                      {channel.cons.map((con, j) => (
                        <li key={j}>• {con}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* 营销策略建议 */}
        <Section
          title="营销策略建议"
          icon={<Lightbulb className="h-4 w-4" />}
          expanded={expandedSections.has('marketing')}
          onToggle={() => toggleSection('marketing')}
        >
          <div className="space-y-3">
            <div>
              <div className="text-xs text-muted-foreground mb-1">目标平台</div>
              <div className="flex flex-wrap gap-1">
                {analysis.marketing.targetPlatforms.map((platform, i) => (
                  <span
                    key={i}
                    className="text-xs px-2 py-1 rounded bg-info/20 text-info"
                  >
                    {platform}
                  </span>
                ))}
              </div>
            </div>

            <div>
              <div className="text-xs text-muted-foreground mb-1">核心卖点</div>
              <div className="flex flex-wrap gap-1">
                {analysis.marketing.keySellingPoints.map((point, i) => (
                  <span
                    key={i}
                    className="text-xs px-2 py-1 rounded bg-primary/20 text-primary"
                  >
                    {point}
                  </span>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="p-2 bg-muted/50 rounded">
                <div className="text-xs text-muted-foreground">推荐预算</div>
                <div className="text-sm font-medium text-foreground">
                  {analysis.marketing.recommendedBudget}
                </div>
              </div>
              <div className="p-2 bg-muted/50 rounded">
                <div className="text-xs text-muted-foreground">营销周期</div>
                <div className="text-sm font-medium text-foreground">{analysis.marketing.timeline}</div>
              </div>
            </div>

            <div>
              <div className="text-xs text-muted-foreground mb-1">营销策略</div>
              <ul className="text-xs text-foreground space-y-1">
                {analysis.marketing.tactics.map((tactic, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-primary">✓</span>
                    <span>{tactic}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Section>
      </div>
    </div>
  )
}

function Section({
  title,
  icon,
  expanded,
  onToggle,
  children,
}: {
  title: string
  icon: React.ReactNode
  expanded: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  return (
    <div>
      <div
        className="flex items-center justify-between p-3 hover:bg-muted/50 cursor-pointer transition-colors"
        onClick={onToggle}
      >
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">{icon}</span>
          <span className="text-sm font-medium text-foreground">{title}</span>
        </div>
        {expanded ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        )}
      </div>
      {expanded && <div className="px-3 pb-3">{children}</div>}
    </div>
  )
}

function ScoreBar({ label, score }: { label: string; score: number }) {
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="text-foreground">{label}</span>
        <span className="text-muted-foreground">{score}/100</span>
      </div>
      <div className="h-1.5 bg-muted/50 rounded overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-info to-primary"
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  )
}
