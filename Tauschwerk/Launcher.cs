using System;
using System.IO;
using System.Net;
using System.Diagnostics;
using System.Threading;
using System.Web.Script.Serialization;
using System.Windows.Forms;
using System.Collections.Generic;

class TauschwerkLauncher {
  [STAThread]
  static void Main(string[] args) {
    string root = AppDomain.CurrentDomain.BaseDirectory;
    try {
      string sharedUrl = Array.IndexOf(args,"--local") >= 0 ? null : ServerUrl(root);
      if (sharedUrl != null) { OpenApp(sharedUrl); return; }
      string runtime = Path.Combine(root,"runtime","node.exe");
      string server = Path.Combine(root,"server.mjs");
      if (!File.Exists(runtime) || !File.Exists(server)) throw new Exception("Der App-Ordner ist unvollständig. Tauschwerk.exe muss zusammen mit runtime und den anderen App-Dateien im selben Ordner bleiben.");
      string url = ExistingSession(root);
      if (url == null) {
        ProcessStartInfo start = new ProcessStartInfo(runtime,Quote(server));
        start.WorkingDirectory = root;
        start.UseShellExecute = false;
        start.CreateNoWindow = true;
        start.RedirectStandardOutput = true;
        start.RedirectStandardError = true;
        Process process = Process.Start(start);
        var read = process.StandardOutput.ReadLineAsync();
        if (!read.Wait(12000)) throw new Exception("Der lokale Dienst antwortet nicht. Bitte die App erneut starten.");
        url = read.Result;
        if (url == null || !url.StartsWith("http://127.0.0.1:")) {
          string message = process.StandardError.ReadToEnd();
          throw new Exception("Der lokale Dienst konnte nicht starten.\n"+message);
        }
      }
      OpenApp(url);
    } catch(Exception error) {MessageBox.Show(error.Message,"Tauschwerk",MessageBoxButtons.OK,MessageBoxIcon.Error);}
  }
  static string ServerUrl(string root) {
    string file = Path.Combine(root,"server-url.json");
    if(!File.Exists(file))return null;
    var settings = new JavaScriptSerializer().Deserialize<Dictionary<string,object>>(File.ReadAllText(file));
    Uri url;
    if(settings == null || !settings.ContainsKey("url") || !Uri.TryCreate(Convert.ToString(settings["url"]),UriKind.Absolute,out url) ||
      (url.Scheme != "http" && url.Scheme != "https") || !String.IsNullOrEmpty(url.UserInfo) || !String.IsNullOrEmpty(url.Query) || !String.IsNullOrEmpty(url.Fragment))
      throw new Exception("Die Server-Adresse in server-url.json ist ungültig. Bitte eine Home-Assistant-Adresse ohne Passwort oder Token eintragen.");
    return url.AbsoluteUri;
  }
  static void OpenApp(string url) {
      string browser = FindBrowser();
      if (browser == null) throw new Exception("Bitte Chrome oder Microsoft Edge installieren. Tauschwerk verwendet dessen App-Fenster für die lokale Oberfläche.");
      ProcessStartInfo app = new ProcessStartInfo(browser,"--app="+Quote(url)+" --window-size=1440,960");
      app.UseShellExecute = false;
      app.CreateNoWindow = true;
      Process.Start(app);
  }
  static string Quote(string s) {return "\""+s.Replace("\"","\\\"")+"\"";}
  static string ExistingSession(string root) {
    bool outdatedAuthenticated = false;
    try {
      string p = Path.Combine(root,"data","session.json");
      if(!File.Exists(p)) return null;
      var data = new JavaScriptSerializer().Deserialize<Dictionary<string,object>>(File.ReadAllText(p));
      int port = Convert.ToInt32(data["port"]);
      string token = Convert.ToString(data["token"]);
      if(port<1 || port>65535 || token.Length!=48) return null;
      string origin = "http://127.0.0.1:"+port;
      HttpWebRequest request = (HttpWebRequest)WebRequest.Create(origin+"/health?token="+Uri.EscapeDataString(token));
      request.Proxy = null;
      request.Timeout = 1200;
      using(var response=(HttpWebResponse)request.GetResponse()) {
        if(response.StatusCode!=HttpStatusCode.OK)return null;
        string json;
        using(var reader=new StreamReader(response.GetResponseStream()))json=reader.ReadToEnd();
        var health=new JavaScriptSerializer().Deserialize<Dictionary<string,object>>(json);
        if(health.ContainsKey("version") && Convert.ToString(health["version"])=="1.6.0")return origin+"/?token="+token;
        outdatedAuthenticated = true;
        // Restart only this app's authenticated, outdated local service.
        int pid=Convert.ToInt32(data["pid"]);
        Process previous=Process.GetProcessById(pid);
        string expected=Path.GetFullPath(Path.Combine(root,"runtime","node.exe"));
        if(String.Equals(Path.GetFullPath(previous.MainModule.FileName),expected,StringComparison.OrdinalIgnoreCase)){
          previous.Kill();previous.WaitForExit(3000);
        }else throw new Exception("Der alte lokale Dienst konnte nicht eindeutig zugeordnet werden. Bitte alte Appfenster schließen, zwei Minuten warten und erneut starten.");
      }
    } catch(Exception error) {
      if(outdatedAuthenticated)throw new Exception("Der alte App-Dienst konnte nicht sicher neu gestartet werden. Bitte alte Appfenster schließen, zwei Minuten warten und erneut starten.\n"+error.Message);
    }
    return null;
  }
  static string FindBrowser() {
    string[] paths = {
      Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles),"Google","Chrome","Application","chrome.exe"),
      Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86),"Google","Chrome","Application","chrome.exe"),
      Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),"Google","Chrome","Application","chrome.exe"),
      Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86),"Microsoft","Edge","Application","msedge.exe"),
      Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles),"Microsoft","Edge","Application","msedge.exe"),
      Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),"Microsoft","Edge","Application","msedge.exe")
    };
    foreach(string path in paths) if(File.Exists(path))return path;
    return null;
  }
}
