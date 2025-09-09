tell application "Google Chrome"
  if (count of windows) = 0 then make new window
  set origins to {"http://localhost:4173","http://localhost:8888","http://localhost:8081"}
  repeat with u in origins
    tell front window to make new tab with properties {URL:(u as text)}
    delay 0.8
    tell active tab of front window to execute javascript "localStorage.DEBUG_ROUTE='1';localStorage.DEBUG_API='1';location.reload();"
    delay 0.8
  end repeat
end tell
