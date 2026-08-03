Option Explicit

Dim fso, baseDir, infoPath, pid
Set fso = CreateObject("Scripting.FileSystemObject")

baseDir = fso.GetParentFolderName(WScript.ScriptFullName)
infoPath = baseDir & "\.runtime\server-info.json"
pid = GetServerPid(infoPath)

If pid = "" Then
  MsgBox "No running service information was found.", vbInformation, "Inventory System"
  WScript.Quit 0
End If

If StopProcess(pid) Then
  DeleteServerInfo infoPath
  MsgBox "Inventory service has been stopped.", vbInformation, "Inventory System"
Else
  DeleteServerInfo infoPath
  MsgBox "Service process was not found. The saved run information has been cleared.", vbInformation, "Inventory System"
End If

Function GetServerPid(path)
  Dim stream, text, re, matches
  GetServerPid = ""
  If Not fso.FileExists(path) Then Exit Function

  On Error Resume Next
  Set stream = fso.OpenTextFile(path, 1)
  text = stream.ReadAll
  stream.Close
  Set re = New RegExp
  re.Pattern = """pid""\s*:\s*([0-9]+)"
  re.IgnoreCase = True
  Set matches = re.Execute(text)
  If matches.Count > 0 Then GetServerPid = matches(0).SubMatches(0)
  On Error GoTo 0
End Function

Function StopProcess(value)
  Dim wmi, processes, process
  StopProcess = False
  On Error Resume Next
  Set wmi = GetObject("winmgmts:\\.\root\cimv2")
  Set processes = wmi.ExecQuery("Select * from Win32_Process Where ProcessId = " & CLng(value))
  For Each process In processes
    process.Terminate()
    StopProcess = True
  Next
  On Error GoTo 0
End Function

Sub DeleteServerInfo(path)
  On Error Resume Next
  If fso.FileExists(path) Then fso.DeleteFile path, True
  On Error GoTo 0
End Sub
