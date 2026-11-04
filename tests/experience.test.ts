import {describe,it,expect} from 'vitest';
import {WORKFLOW,DEMO_CASES,workflowForPath,demoDestination} from '../lib/experience';
describe('beginner workflow navigation',()=>{
 it('offers four distinct task routes and textual labels alongside colors',()=>{expect(new Set(WORKFLOW.map(s=>s.href)).size).toBe(4);expect(new Set(WORKFLOW.map(s=>s.color)).size).toBe(4);expect(WORKFLOW.map(s=>s.number)).toEqual(['01','02','03','04']);for(const s of WORKFLOW){expect(s.detail.length).toBeGreaterThan(0);expect(s.output.length).toBeGreaterThan(0);}});
 it('places company evidence within review, while keeping references outside task progress',()=>{expect(workflowForPath('/companies/proasin')?.id).toBe('verify');expect(workflowForPath('/outreach/')?.id).toBe('outreach');expect(workflowForPath('/sources')).toBeUndefined();expect(workflowForPath('/methodology')).toBeUndefined();expect(workflowForPath('/')).toBeUndefined();});
 it.each(DEMO_CASES)('opens $name in the isolated demo, never in main',c=>{const url=new URL(demoDestination(c.id),'https://example.test');expect(url.pathname).toBe('/outreach');expect(url.searchParams.get('scope')).toBe('demo');expect(url.searchParams.get('company')).toBe(c.id);expect(url.searchParams.get('guide')).toBe('1');});
 it('cannot put an arbitrary target or query injection into the demo link',()=>{expect(demoDestination('proasin&scope=main')).toBe(demoDestination('proasin'));expect(demoDestination('https://other.test')).toBe(demoDestination('proasin'));});
});
