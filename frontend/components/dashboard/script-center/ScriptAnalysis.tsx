'use client'

import { useState, useEffect } from 'react'
import {
  BarChart3,
  LineChart,
  PieChart,
  Sparkles,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { scriptCenterService } from '@/services/script-center.service'

interface ScriptAnalysisProps {
  scriptId: string
}

export function ScriptAnalysis({ scriptId }: ScriptAnalysisProps) {
  const [statistics, setStatistics] = useState<any>(null)
  const [assessment, setAssessment] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [generatingAssessment, setGeneratingAssessment] = useState(false)

  useEffect(() => {
    loadStatistics()
    loadAssessment()
  }, [scriptId])

  const loadStatistics = async () => {
    try {
      const stats = await scriptCenterService.getStatistics(scriptId)
      setStatistics(stats)
    } catch (error) {
      console.error('Failed to load statistics:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadAssessment = async () => {
    try {
      const result = await scriptCenterService.getAIAssessment(scriptId)
      setAssessment(result)
    } catch (error) {
      console.error('Failed to load assessment:', error)
    }
  }

  const generateAssessment = async () => {
    setGeneratingAssessment(true)
    try {
      await scriptCenterService.generateAIAssessment(scriptId)
      await loadAssessment()
    } catch (error) {
      console.error('Failed to generate assessment:', error)
    } finally {
      setGeneratingAssessment(false)
    }
  }

  if (loading) {
    return (
      <div className="script-analysis bg-[#1a1a1a] rounded-lg border border-white/10 overflow-hidden p-8">
        <div className="text-center text-[#666]">加载中...</div>
      </div>
    )
  }

  return (
    <div className="script-analysis bg-[#1a1a1a] rounded-lg border border-white/10 overflow-hidden">
      {/* 标题 */}
      <div className="p-3 border-b border-white/10 flex items-center justify-between">
        <h3 className="text-sm font-medium text-white flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-[#888]" />
          剧本分析
        </h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={generateAssessment}
          disabled={generatingAssessment}
          className="h-7"
        >
          <Sparkles className="h-3 w-3 mr-1" />
          {generatingAssessment ? '生成中...' : 'AI评分'}
        </Button>
      </div>

      <div className="p-4 space-y-4">
        {/* 基础统计 */}
        {statistics && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-white/5 rounded-lg p-3">
              <div className="text-xs text-[#888] mb-1">总字数</div>
              <div className="text-lg font-bold text-white">
                {statistics.totalWords.toLocaleString()}
              </div>
            </div>
            <div className="bg-white/5 rounded-lg p-3">
              <div className="text-xs text-[#888] mb-1">场景数</div>
              <div className="text-lg font-bold text-white">
                {statistics.totalScenes}
              </div>
            </div>
            <div className="bg-white/5 rounded-lg p-3">
              <div className="text-xs text-[#888] mb-1">角色数</div>
              <div className="text-lg font-bold text-white">
                {statistics.totalCharacters}
              </div>
            </div>
            <div className="bg-white/5 rounded-lg p-3">
              <div className="text-xs text-[#888] mb-1">对白数</div>
              <div className="text-lg font-bold text-white">
                {statistics.totalDialogues}
              </div>
            </div>
          </div>
        )}

        {/* AI评分 */}
        {assessment && (
          <div className="border border-white/10 rounded-lg p-3">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-purple-400" />
                <span className="text-sm font-medium text-white">AI评分</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-[#888]">综合得分</span>
                <span className="text-lg font-bold text-purple-400">
                  {assessment.overall.toFixed(1)}
                </span>
              </div>
            </div>

            {/* 维度评分 */}
            <div className="space-y-2">
              {assessment.dimensions.map((dimension: any, index: number) => (
                <div key={index} className="bg-white/5 rounded p-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-white">{dimension.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-[#888]">
                        权重: {(dimension.weight * 100).toFixed(0)}%
                      </span>
                      <span className="text-sm font-bold text-white">
                        {dimension.score.toFixed(1)}
                      </span>
                    </div>
                  </div>
                  <div className="w-full bg-white/10 rounded-full h-1.5">
                    <div
                      className="bg-purple-400 h-1.5 rounded-full"
                      style={{ width: `${dimension.score * 10}%` }}
                    />
                  </div>
                  {dimension.suggestions.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {dimension.suggestions.map((suggestion: string, sIndex: number) => (
                        <div
                          key={sIndex}
                          className="text-xs text-[#888] flex items-start gap-1"
                        >
                          <AlertTriangle className="h-3 w-3 text-yellow-400 flex-shrink-0 mt-0.5" />
                          {suggestion}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* 总结 */}
            {assessment.summary && (
              <div className="mt-3 p-2 bg-purple-500/10 rounded border border-purple-500/20">
                <div className="text-xs text-purple-400 mb-1">分析总结</div>
                <div className="text-sm text-white">{assessment.summary}</div>
              </div>
            )}
          </div>
        )}

        {/* 角色出场频率 */}
        {statistics?.characterFrequency && (
          <div className="border border-white/10 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-3">
              <PieChart className="h-4 w-4 text-blue-400" />
              <span className="text-sm font-medium text-white">角色出场频率</span>
            </div>
            <div className="space-y-2">
              {statistics.characterFrequency
                .slice(0, 5)
                .map((char: any, index: number) => (
                  <div key={index} className="flex items-center justify-between">
                    <span className="text-xs text-white">{char.name}</span>
                    <div className="flex items-center gap-2">
                      <div className="w-32 bg-white/10 rounded-full h-2">
                        <div
                          className="bg-blue-400 h-2 rounded-full"
                          style={{
                            width: `${(char.count / statistics.characterFrequency[0].count) * 100}%`,
                          }}
                        />
                      </div>
                      <span className="text-xs text-[#888]">{char.count}</span>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* 场景分布 */}
        {statistics?.sceneDistribution && (
          <div className="border border-white/10 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-3">
              <LineChart className="h-4 w-4 text-emerald-400" />
              <span className="text-sm font-medium text-white">场景分布</span>
            </div>
            <div className="space-y-2">
              {statistics.sceneDistribution.slice(0, 5).map((scene: any, index: number) => (
                <div key={index} className="flex items-center justify-between">
                  <span className="text-xs text-white">{scene.location}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-32 bg-white/10 rounded-full h-2">
                      <div
                        className="bg-emerald-400 h-2 rounded-full"
                        style={{
                          width: `${(scene.count / statistics.sceneDistribution[0].count) * 100}%`,
                        }}
                      />
                    </div>
                    <span className="text-xs text-[#888]">{scene.count}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 节奏曲线 */}
        {statistics?.pacingData && (
          <div className="border border-white/10 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="h-4 w-4 text-orange-400" />
              <span className="text-sm font-medium text-white">节奏曲线</span>
            </div>
            <div className="relative h-16">
              {/* 简化的节奏曲线显示 */}
              <svg className="w-full h-full" viewBox="0 0 100 60">
                <path
                  d={`M 0 30 ${statistics.pacingData
                    .map((point: any, i: number) => `L ${(i / statistics.pacingData.length) * 100} ${60 - point.intensity * 6}`)
                    .join(' ')}`}
                  fill="none"
                  stroke="#f97316"
                  strokeWidth="2"
                />
              </svg>
            </div>
            <div className="flex justify-between mt-2">
              <span className="text-xs text-[#888]">开始</span>
              <span className="text-xs text-[#888]">结尾</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}