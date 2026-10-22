param(
    [string]$Domain = 'wextheory.cv',
    [string]$Server = 'dns1.registrar-servers.com'
)

# Public DNS only. This script never changes records or sends a message.
$queries = @(
    @{Name=$Domain; Type='NS'},
    @{Name=$Domain; Type='MX'},
    @{Name=$Domain; Type='TXT'},
    @{Name="_dmarc.$Domain"; Type='TXT'},
    @{Name="mail.$Domain"; Type='MX'},
    @{Name="mail.$Domain"; Type='TXT'},
    @{Name="send.mail.$Domain"; Type='MX'},
    @{Name="send.mail.$Domain"; Type='TXT'},
    @{Name="resend._domainkey.mail.$Domain"; Type='TXT'}
)
$observations = foreach ($query in $queries) {
    try {
        $records = @(Resolve-DnsName -Name $query.Name -Type $query.Type -Server $Server -DnsOnly -ErrorAction Stop | Where-Object { [string]$_.Type -eq $query.Type })
        $values = @($records | ForEach-Object {
            if ($query.Type -eq 'NS') { $_.NameHost }
            elseif ($query.Type -eq 'MX') { [ordered]@{exchange=$_.NameExchange; preference=$_.Preference} }
            else { $_.Strings -join '' }
        })
        [ordered]@{name=$query.Name; type=$query.Type; status=$(if($values.Count){'answer'}else{'no_records'}); values=$values}
    }
    catch {
        [ordered]@{name=$query.Name; type=$query.Type; status='lookup_error'; error=$_.FullyQualifiedErrorId; values=@()}
    }
}
[ordered]@{
    checked_at_utc=[DateTime]::UtcNow.ToString('o')
    domain=$Domain
    resolver=$Server
    records=@($observations)
    limits='Public records cannot confirm a purchased subscription, mailbox existence, receipt or reply delivery.'
} | ConvertTo-Json -Depth 6
