-- Delete Piperun records to force full re-sync with proper stage mapping
DELETE FROM crm_prospections WHERE source = 'piperun';