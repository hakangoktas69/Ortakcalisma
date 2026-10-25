{{- define "eworks.image" -}}
{{- $r := .root.Values.image.registry -}}
{{- printf "%s%s:%s" (ternary (printf "%s/" $r) "" (ne $r "")) .name .root.Values.image.tag -}}
{{- end -}}

{{- define "eworks.guvenlik" -}}
securityContext:
  runAsNonRoot: true
  allowPrivilegeEscalation: false
  readOnlyRootFilesystem: true
  capabilities: { drop: [ALL] }
{{- end -}}

{{- define "eworks.labels" -}}
app.kubernetes.io/name: {{ .name }}
app.kubernetes.io/part-of: eworks
{{- end -}}
