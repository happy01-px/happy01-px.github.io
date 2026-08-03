Option Explicit

Dim shell, fso, baseDir, infoPath, liveUrl, nodePath, serverPath
Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

baseDir = fso.GetParentFolderName(WScript.ScriptFullName)
shell.CurrentDirectory = baseDir
infoPath = baseDir & "\.runtime\server-info.json"

liveUrl = GetLiveServerUrl(infoPath)
If liveUrl <> "" Then
  shell.Run liveUrl, 1, False
  WScript.Quit 0
End If

nodePath = FindNodePath()
If nodePath = "" Then
  MsgBox "Node.js was not found. Please install Node.js or use the packaged exe version.", vbExclamation, "Inventory System"
  WScript.Quit 1
End If

serverPath = baseDir & "\preview_server.js"
If Not fso.FileExists(serverPath) Then
  MsgBox "preview_server.js was not found.", vbExclamation, "Inventory System"
  WScript.Quit 1
End If

shell.Run Quote(nodePath) & " " & Quote(serverPath) & " --open", 0, False

Function Quote(value)
  Quote = Chr(34) & value & Chr(34)
End Function

Function FindNodePath()
  Dim candidates, i, pathValue, parts, folder, candidate
  candidates = Array( _
    baseDir & "\node.exe", _
    shell.ExpandEnvironmentStrings("%ProgramFiles%") & "\nodejs\node.exe", _
    shell.ExpandEnvironmentStrings("%ProgramFiles(x86)%") & "\nodejs\node.exe" _
  )

  For i = 0 To UBound(candidates)
    If fso.FileExists(candidates(i)) Then
      FindNodePath = candidates(i)
      Exit Function
    End If
  Next

  pathValue = shell.ExpandEnvironmentStrings("%PATH%")
  parts = Split(pathValue, ";")
  For i = 0 To UBound(parts)
    folder = Trim(shell.ExpandEnvironmentStrings(parts(i)))
    If folder <> "" Then
      candidate = fso.BuildPath(folder, "node.exe")
      If fso.FileExists(candidate) Then
        FindNodePath = candidate
        Exit Function
      End If
    End If
  Next

  FindNodePath = ""
End Function

Function GetLiveServerUrl(path)
  Dim stream, text, re, matches, url
  GetLiveServerUrl = ""
  If Not fso.FileExists(path) Then Exit Function

  On Error Resume Next
  Set stream = fso.OpenTextFile(path, 1)
  text = stream.ReadAll
  stream.Close
  Set re = New RegExp
  re.Pattern = """url""\s*:\s*""([^""]+)"""
  re.IgnoreCase = True
  Set matches = re.Execute(text)
  If matches.Count > 0 Then
    url = matches(0).SubMatches(0)
    If IsUrlAlive(url) Then GetLiveServerUrl = url
  End If
  On Error GoTo 0
End Function

Function IsUrlAlive(url)
  Dim http
  IsUrlAlive = False
  On Error Resume Next
  Set http = CreateObject("MSXML2.ServerXMLHTTP.6.0")
  http.setTimeouts 500, 500, 500, 500
  http.open "GET", url, False
  http.send
  If Err.Number = 0 Then
    If http.Status >= 200 And http.Status < 500 Then IsUrlAlive = True
  End If
  On Error GoTo 0
End Function
