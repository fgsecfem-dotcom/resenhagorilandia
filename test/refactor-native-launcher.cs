using System;
using System.IO;
using System.Diagnostics;
public class RefactorNativeLauncher {
 [STAThread] public static void Main(){
  string root=AppDomain.CurrentDomain.BaseDirectory;
  string[] config=File.ReadAllLines(Path.Combine(root,"refactor-launch.txt"));
  string folder=config[0],label=config[1],temp=Path.Combine(root,"refactor-runtime-temp");Directory.CreateDirectory(temp);
  var info=new ProcessStartInfo(Path.Combine(folder,"Resenha.exe"),"--profile=auditoria-ref16-20261014 --inspect=127.0.0.1:19226 --remote-debugging-port=19227 --remote-debugging-address=127.0.0.1 --use-fake-device-for-media-stream --use-fake-ui-for-media-stream");
  info.UseShellExecute=false;info.CreateNoWindow=true;info.WorkingDirectory=temp;
  info.EnvironmentVariables["TEMP"]=temp;info.EnvironmentVariables["TMP"]=temp;
  info.RedirectStandardOutput=true;info.RedirectStandardError=true;
  using(var log=new StreamWriter(Path.Combine(root,"refactor-native-"+label+".log"),false)){
   var started=DateTime.UtcNow;
   using(var p=new Process()){p.StartInfo=info;
    p.OutputDataReceived+=(s,e)=>{if(e.Data!=null)lock(log){log.WriteLine(e.Data);log.Flush();}};
    p.ErrorDataReceived+=(s,e)=>{if(e.Data!=null)lock(log){log.WriteLine(e.Data);log.Flush();}};
    p.Start();p.BeginOutputReadLine();p.BeginErrorReadLine();
    for(int i=0;i<1500&&!p.HasExited;i++){p.Refresh();if(p.MainWindowHandle!=IntPtr.Zero){File.WriteAllText(Path.Combine(root,"refactor-native-"+label+".json"),"{\"pid\":"+p.Id+",\"spawnToNativeWindowMs\":"+(long)(DateTime.UtcNow-started).TotalMilliseconds+",\"pollIntervalMs\":20}");break;}System.Threading.Thread.Sleep(20);}
    p.WaitForExit();
   }
  }
 }
}
