/**
 * @file review.mapper.ts
 * @description Review 聚合 ↔ SQLite 行双向映射。
 *
 * 权威模型：review_items 表（迭代计划 §6.6）。本 Mapper 只读写聚合权威字段：
 *  - 状态、版本、驳回次数、重新提交次数、驳回原因、审批/提交/审核人、前序链、时间戳。
 *
 * 不读不写 SLA 元数据字段（sla_due_at / escalation_level / escalated_at / breached_at）——
 * 这些由 SLA 服务独占（迭代计划 §6.5：SLA 服务不得修改审核状态；反之审核聚合也不动 SLA）。
 * 不读不写展示字段（title / description / priority / approved_by / rejected_by / rejected_at /
 * approval_level / current_level / deleted_at）——这些由调用方经 Read Model 维护，
 * 聚合只对状态机相关字段负责。
 */

import { ReviewAggregate } from "../../domain/review/review.aggregate.js";
import type { ReviewStatus } from "../../domain/review/review-state-machine.js";
import type { RejectionReasonCode } from "../../domain/review/rejection-reason.value-object.js";

export type SqliteRow = Readonly<Record<string, unknown>>;

function text(value: unknown): string {
  return value === null || value === undefined ? "" : String(value);
}

function integer(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export interface ReviewPersistenceRow {
  /** 聚合权威字段，与 review_items 表列名对齐（snake_case）。 */
  id: string;
  target_type: string;
  target_id: string;
  project_id: string;
  status: ReviewStatus;
  rejected_count: number;
  rejection_reason_code: string;
  approved_at: string;
  submitted_by: string;
  reviewed_by: string;
  re_submit_count: number;
  previous_review_id: string;
  chain_id: string;
  pipeline_run_id: string;
  pipeline_node_id: string;
  created_at: string;
  updated_at: string;
  version: number;
}

/** 把 SQLite 行还原成 ReviewAggregate（rehydrate，不产生事件/历史）。 */
export class ReviewMapper {
  static toDomain(row: SqliteRow): ReviewAggregate {
    return ReviewAggregate.rehydrate({
      id: text(row.id),
      targetType: text(row.target_type),
      targetId: text(row.target_id),
      projectId: text(row.project_id),
      status: text(row.status) as ReviewStatus,
      rejectedCount: integer(row.rejected_count, 0),
      rejectionReasonCode:
        (text(row.rejection_reason_code) as RejectionReasonCode | "") || "",
      reSubmitCount: integer(row.re_submit_count, 0),
      approvedAt: text(row.approved_at),
      submittedBy: text(row.submitted_by),
      reviewedBy: text(row.reviewed_by),
      previousReviewId: text(row.previous_review_id),
      chainId: text(row.chain_id),
      pipelineRunId: text(row.pipeline_run_id) || undefined,
      pipelineNodeId: text(row.pipeline_node_id) || undefined,
      createdAt: text(row.created_at),
      updatedAt: text(row.updated_at),
      version: integer(row.version, 1),
    });
  }

  /** 从聚合导出权威字段（用于 INSERT/UPDATE；SLA 与展示字段不在其中）。 */
  static toPersistence(aggregate: ReviewAggregate): ReviewPersistenceRow {
    const reasonCode = aggregate.rejectionReasonCode
      ? aggregate.rejectionReasonCode.code
      : "";
    return {
      id: aggregate.id,
      target_type: aggregate.targetType,
      target_id: aggregate.targetId,
      project_id: aggregate.projectId,
      status: aggregate.status,
      rejected_count: aggregate.rejectedCount,
      rejection_reason_code: reasonCode,
      approved_at: aggregate.approvedAt,
      submitted_by: aggregate.submittedBy,
      reviewed_by: aggregate.reviewedBy,
      re_submit_count: aggregate.reSubmitCount,
      previous_review_id: aggregate.previousReviewId,
      chain_id: aggregate.chainId,
      pipeline_run_id: aggregate.pipelineRunId ?? "",
      pipeline_node_id: aggregate.pipelineNodeId ?? "",
      created_at: aggregate.createdAt,
      updated_at: aggregate.updatedAt,
      version: aggregate.version,
    };
  }
}
