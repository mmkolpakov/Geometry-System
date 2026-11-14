import {describe,it,expect} from 'vitest';
import {defaults,readSession,sessionQuery} from './session';
describe('share state',()=>{
 it('round trips a reproducible experiment',()=>expect(readSession('?'+sessionQuery({...defaults,view:'lab',geometry:'hyperbolic',size:.6,advanced:true}))).toEqual({...defaults,view:'lab',geometry:'hyperbolic',size:.6,advanced:true}));
 it('rejects corrupt parameters',()=>{const s=readSession('?view=bad&geometry=bad&size=NaN&lesson=999');expect(s.view).toBe('journey');expect(s.size).toBe(.75);expect(s.lesson).toBe(5);});
 it('round trips compared trajectories and the selected paused frame',()=>{
   const state={...defaults,view:'lab' as const,lab:'threebody' as const,preset:'chaotic' as const,comparisonEnabled:true,perturbation:.0007,sampleIndex:412};
   expect(readSession('?'+sessionQuery(state))).toEqual(state);
 });
 it('bounds and validates untrusted trajectory parameters',()=>{
   expect(readSession('?compare=yes&dv=NaN&frame=Infinity')).toMatchObject({comparisonEnabled:false,perturbation:.0001,sampleIndex:0});
   expect(readSession('?compare=1&dv=100&frame=900')).toMatchObject({comparisonEnabled:true,perturbation:.001,sampleIndex:600});
   expect(readSession('?dv=-3&frame=-10')).toMatchObject({perturbation:.0001,sampleIndex:0});
 });
 it('keeps a shared lesson attached to its laboratory while permitting parameter experiments',()=>{
   expect(readSession('?view=journey&lesson=5&lab=geometry&preset=triangle')).toMatchObject({lab:'threebody',preset:'triangle'});
   expect(readSession('?view=journey&lesson=0&lab=threebody&geometry=sphere')).toMatchObject({lab:'geometry',geometry:'sphere'});
   expect(readSession('?view=lab&lesson=0&lab=threebody')).toMatchObject({lab:'threebody'});
 });
 it('chooses the lesson model when a direct link omits explicit laboratory parameters',()=>{
   expect(readSession('?view=journey&lesson=5')).toMatchObject({lab:'threebody',preset:'chaotic'});
   expect(readSession('?view=journey&lesson=1')).toMatchObject({lab:'geometry',geometry:'sphere'});
 });
});
