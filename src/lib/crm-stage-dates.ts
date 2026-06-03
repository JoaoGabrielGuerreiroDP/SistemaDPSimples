type CrmDeal = {
  stage_changed_at?: string | null;
  last_stage_updated_at?: string | null;
  properties?: Record<string, string | null | undefined>;
};

export function getPiperunStageEntryDate(deal: CrmDeal | null | undefined): string | null {
  return deal?.stage_changed_at || null;
}

export function getHubSpotStageEntryDate(deal: CrmDeal | null | undefined): string | null {
  const properties = deal?.properties || {};
  const stageId = properties.dealstage;

  if (stageId) {
    const stageKey = String(stageId);
    return (
      properties[`hs_date_entered_${stageKey}`] ||
      properties[`hs_v2_date_entered_${stageKey}`] ||
      null
    );
  }

  return null;
}

export function getStageEntryTime(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const time = new Date(raw).getTime();
  return Number.isNaN(time) ? null : time;
}