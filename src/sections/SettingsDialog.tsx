import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import { Settings, Cloud, CloudOff, Copy, Check } from 'lucide-react'
import {
  loadConfig, saveConfig, testConnection, cloudReady,
  SUPABASE_SETUP_SQL, type SyncConfig,
} from '@/lib/sync'

export default function SettingsDialog({ onChanged }: { onChanged: (cfg: SyncConfig) => void }) {
  const [open, setOpen] = useState(false)
  const [cfg, setCfg] = useState<SyncConfig>(loadConfig)
  const [msg, setMsg] = useState('')
  const [testing, setTesting] = useState(false)
  const [copied, setCopied] = useState(false)

  const ready = cloudReady(cfg)

  const save = async () => {
    saveConfig(cfg)
    onChanged({ ...cfg })
    if (cloudReady(cfg)) {
      setTesting(true)
      setMsg('正在测试云端连接…')
      try {
        setMsg(await testConnection(cfg))
      } catch (e) {
        setMsg('连接失败：' + (e as Error).message)
      } finally {
        setTesting(false)
      }
    } else {
      setMsg('已保存。当前为仅本机模式（不配置 Supabase 时数据只存在这台设备）。')
    }
  }

  const copySql = async () => {
    await navigator.clipboard.writeText(SUPABASE_SETUP_SQL)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          {ready ? <Cloud className="w-4 h-4 mr-1" /> : <CloudOff className="w-4 h-4 mr-1" />}
          同步设置
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>跨设备同步设置</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-slate-600 leading-relaxed">
          不配置时所有数据只保存在本机浏览器。配置 Supabase 免费云端后，
          持仓记录可以在手机、电脑、平板之间实时同步。
        </p>

        <div className="rounded-xl bg-slate-50 p-3 text-sm leading-relaxed">
          <h4 className="font-bold mb-1">第一步：创建免费云端数据库（2 分钟，只需一次）</h4>
          <ol className="list-decimal ml-4 space-y-1 text-slate-600">
            <li>打开 <b>supabase.com</b>，用邮箱/GitHub 注册免费账号，新建一个项目</li>
            <li>左侧菜单 SQL Editor → 新建查询，粘贴下面这段 SQL 并执行</li>
            <li>项目 Settings → API 里复制 <b>Project URL</b> 和 <b>anon public key</b>，填到下面</li>
          </ol>
          <div className="relative mt-2">
            <pre className="rounded-lg bg-slate-900 text-slate-100 text-xs p-3 overflow-x-auto whitespace-pre-wrap">
              {SUPABASE_SETUP_SQL}
            </pre>
            <Button size="sm" variant="secondary" className="absolute top-2 right-2" onClick={copySql}>
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            </Button>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <Label className="mb-1 block">Supabase Project URL</Label>
            <Input
              value={cfg.supabaseUrl}
              onChange={(e) => setCfg({ ...cfg, supabaseUrl: e.target.value.trim() })}
              placeholder="https://abcdefgh.supabase.co"
            />
          </div>
          <div>
            <Label className="mb-1 block">anon public key</Label>
            <Input
              value={cfg.supabaseKey}
              onChange={(e) => setCfg({ ...cfg, supabaseKey: e.target.value.trim() })}
              placeholder="eyJhbGciOi..."
            />
          </div>
          <div>
            <Label className="mb-1 block">同步密钥（自己设一个，比如一段英文加数字）</Label>
            <Input
              value={cfg.ownerKey}
              onChange={(e) => setCfg({ ...cfg, ownerKey: e.target.value })}
              placeholder="你的私有密钥，不要告诉别人"
            />
            <p className="text-xs text-muted-foreground mt-1">
              云端只保存「知道密钥的人」的数据。每台设备填同样的三项即可互通。
            </p>
          </div>
          <div>
            <Label className="mb-1 block">推荐数据地址（高级，留空用内置数据）</Label>
            <Input
              value={cfg.dataUrl}
              onChange={(e) => setCfg({ ...cfg, dataUrl: e.target.value.trim() })}
              placeholder="https://你的域名/recommendations.json"
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button onClick={save} disabled={testing}>
            <Settings className="w-4 h-4 mr-1" /> 保存
          </Button>
          {msg && <span className="text-sm text-slate-600">{msg}</span>}
        </div>
      </DialogContent>
    </Dialog>
  )
}
