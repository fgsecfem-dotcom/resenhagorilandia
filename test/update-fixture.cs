using System;
using System.IO;
using System.Text.RegularExpressions;
using System.Threading;
class Fixture {
 static void Main(string[] args) {
  string dir=AppDomain.CurrentDomain.BaseDirectory;
  string pkg=File.ReadAllText(Path.Combine(dir,"resources","app","package.json"));
  if(pkg.Contains("\"mode\":\"fail\""))return;
  if(pkg.Contains("\"mode\":\"hang\"")){Thread.Sleep(90000);return;}
  if(pkg.Contains("\"mode\":\"old\"")){File.WriteAllText(Path.Combine(dir,"old-reopened.txt"),"ok");return;}
  string version=Regex.Match(pkg,"\"version\":\"([^\"]+)\"").Groups[1].Value;
  foreach(string a in args)if(a.StartsWith("--updated=")){
   string id=a.Substring(10);string root=Path.Combine(Directory.GetParent(dir.TrimEnd(Path.DirectorySeparatorChar)).FullName,".resenha-update-"+id);
   File.WriteAllText(Path.Combine(root,"ready.json"),"{\"id\":\""+id+"\",\"version\":\""+version+"\",\"pid\":"+System.Diagnostics.Process.GetCurrentProcess().Id+"}");
  }
  Thread.Sleep(4000);
 }
}
