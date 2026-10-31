# Ajudante da ilha do Resenha (Windows). Só lê: qual programa está em primeiro plano e se uma tecla está apertada.
# Não instala gancho de teclado, não toca no jogo. Comandos (uma linha cada) em stdin, respostas em stdout:
#   ping          -> pong
#   fg            -> fg|pid|tela cheia 0/1|esq|topo|dir|base|caminho do exe|título
#   w <vk>        -> espera a tecla ser solta e responde up
#   procs         -> procs|nome\x01caminho\x01título\x02...
$ErrorActionPreference = 'SilentlyContinue'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Add-Type -TypeDefinition @'
using System; using System.Runtime.InteropServices; using System.Text; using System.Collections.Generic;
public static class RW {
  [StructLayout(LayoutKind.Sequential)] struct RECT { public int L, T, R, B; }
  [StructLayout(LayoutKind.Sequential)] struct MINFO { public int cb; public RECT m; public RECT w; public uint f; }
  delegate bool EnumProc(IntPtr h, IntPtr l);
  [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [DllImport("user32.dll")] static extern bool GetWindowRect(IntPtr h, out RECT r);
  [DllImport("user32.dll")] static extern IntPtr MonitorFromWindow(IntPtr h, uint f);
  [DllImport("user32.dll")] static extern bool GetMonitorInfo(IntPtr m, ref MINFO i);
  [DllImport("user32.dll")] public static extern short GetAsyncKeyState(int vk);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll")] static extern bool EnumWindows(EnumProc p, IntPtr l);
  [DllImport("kernel32.dll")] static extern IntPtr OpenProcess(uint a, bool i, uint pid);
  [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr h);
  [DllImport("kernel32.dll", CharSet = CharSet.Unicode)] static extern bool QueryFullProcessImageName(IntPtr p, uint f, StringBuilder s, ref uint n);
  static string Exe(uint pid) {
    IntPtr p = OpenProcess(0x1000, false, pid); if (p == IntPtr.Zero) return "";
    var sb = new StringBuilder(1024); uint n = 1024; string r = QueryFullProcessImageName(p, 0, sb, ref n) ? sb.ToString() : ""; CloseHandle(p); return r;
  }
  static string Title(IntPtr h) { var sb = new StringBuilder(256); GetWindowText(h, sb, 256); return sb.ToString().Replace("|", " "); }
  public static string Fg() {
    IntPtr h = GetForegroundWindow(); if (h == IntPtr.Zero) return "";
    uint pid; GetWindowThreadProcessId(h, out pid); RECT r; GetWindowRect(h, out r);
    var mi = new MINFO(); mi.cb = Marshal.SizeOf(typeof(MINFO)); int fs = 0;
    if (GetMonitorInfo(MonitorFromWindow(h, 2), ref mi) && r.L <= mi.m.L && r.T <= mi.m.T && r.R >= mi.m.R && r.B >= mi.m.B) fs = 1;
    return pid + "|" + fs + "|" + r.L + "|" + r.T + "|" + r.R + "|" + r.B + "|" + Exe(pid) + "|" + Title(h);
  }
  public static string Procs() {
    var seen = new HashSet<string>(); var outp = new StringBuilder();
    EnumWindows((h, l) => {
      if (!IsWindowVisible(h)) return true; string t = Title(h); if (t.Length == 0) return true;
      uint pid; GetWindowThreadProcessId(h, out pid); string exe = Exe(pid); if (exe.Length == 0 || !seen.Add(exe.ToLowerInvariant())) return true;
      outp.Append(System.IO.Path.GetFileName(exe)).Append('\u0001').Append(exe).Append('\u0001').Append(t).Append('\u0002'); return true;
    }, IntPtr.Zero);
    return outp.ToString();
  }
}
'@
while (($line = [Console]::In.ReadLine()) -ne $null) {
  $p = $line.Trim().Split(' ')
  switch ($p[0]) {
    'ping' { [Console]::Out.WriteLine('pong') }
    'fg' { [Console]::Out.WriteLine('fg|' + [RW]::Fg()) }
    'procs' { [Console]::Out.WriteLine('procs|' + [RW]::Procs()) }
    'w' {
      $vk = [int]$p[1]
      while (([RW]::GetAsyncKeyState($vk) -band 0x8000) -ne 0) { Start-Sleep -Milliseconds 20 }
      [Console]::Out.WriteLine('up')
    }
  }
  [Console]::Out.Flush()
}
