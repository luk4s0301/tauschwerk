import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {root} from './helper.mjs';

test('HA-Repository entdeckt die App mit übereinstimmender Release-Version',()=>{
  const repository=JSON.parse(fs.readFileSync(path.join(root,'..','repository.json')));
  const config=JSON.parse(fs.readFileSync(path.join(root,'config.json')));
  const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json')));
  assert.equal(repository.url,'https://github.com/luk4s0301/tauschwerk');
  assert.equal(config.version,pkg.version);
  assert.deepEqual(config.arch,['amd64','aarch64']);
  assert.equal(config.ingress,true);assert.equal(config.ingress_port,8099);
  assert.equal(config.ports,undefined);assert.equal(config.image,undefined);
});
test('Veröffentlichter Container kopiert nur Laufzeitdateien und verwendet dauerhaften Speicher',()=>{
  const docker=fs.readFileSync(path.join(root,'Dockerfile'),'utf8');
  assert.match(docker,/TAUSCHWERK_DATA=\/data/);
  assert.match(docker,/TAUSCHWERK_HOME_ASSISTANT=1/);
  const ignore=fs.readFileSync(path.join(root,'.dockerignore'),'utf8');
  assert.equal(ignore.split('\n')[0],'*');
  for(const match of docker.matchAll(/^COPY (.+) (?:\.\/|\.\/public\/)$/gm)){
    for(const file of match[1].split(' ')){
      assert.ok(fs.existsSync(path.join(root,file)),file);
      assert.ok(ignore.split('\n').includes('!'+file),file+' must be included');
      assert.ok(!/data|runtime|initial-store|server-url/.test(file.replace('market-value','')),file+' must not be personal data');
    }
  }
  assert.ok(!docker.includes('COPY . .'));
  assert.ok(!ignore.includes('!initial-store.json'));
});
