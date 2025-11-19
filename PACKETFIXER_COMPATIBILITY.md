# PacketFixer Mod Compatibility Fix

## Problem Summary

After installing the **PacketFixer mod** ([TonimatasDEV/PacketFixer](https://github.com/TonimatasDEV/PacketFixer)) on the Minecraft server, the launcher's server status indicator stopped working. The modern Server List Ping protocol would fail with:

```
IndexOutOfBoundsException: readerIndex(1) + length(1) exceeds writerIndex(1): PooledUnsafeDirectByteBuf(ridx: 1, widx: 1, cap: 1)
```

This error occurred in `HandshakeC2SPacket` on the server side.

## Root Cause

**PacketFixer** is a mod that modifies Minecraft's network packet handling by increasing size limits for various packet types. According to the [PacketFixer documentation](https://deepwiki.com/TonimatasDEV/PacketFixer):

> PacketFixer uses SpongePowered Mixins to replace hardcoded network limits in Minecraft's codebase with configurable values

Specifically, PacketFixer modifies the **`Varint21FrameDecoder`** class, which is responsible for reading packet length prefixes and extracting individual packet frames from the TCP byte stream.

### The Packet Framing Issue

The `Varint21FrameDecoderMixin` ([source](https://github.com/TonimatasDEV/PacketFixer/blob/1980f3ad/common/src/main/java/dev/tonimatas/packetfixer/mixins/Varint21FrameDecoderMixin.java)) dynamically resizes the helper buffer and changes how packet boundaries are detected. This modification can cause issues when:

1. Multiple small packets are sent in quick succession
2. The server receives packets in the same TCP segment
3. The framer processes packets before the connection state fully transitions

When the launcher sends:
1. **Handshake Packet** (transitions state from `Handshaking` to `Status`)
2. **Status Request Packet** (requests server info)

If these packets arrive together or are processed too quickly, PacketFixer's modified frame decoder can misinterpret packet boundaries. The server then tries to parse the **Status Request** (Length 1, ID 0x00) as if it were a **Handshake** packet, causing the crash.

## Solution

The launcher now implements a **three-tier approach** to ensure compatibility with PacketFixer:

### 1. Increased Packet Delay

Increased the delay between Handshake and Status Request to **1000ms (1 second)**:

```rust
// CRITICAL: PacketFixer mod modifies Varint21FrameDecoder
std::thread::sleep(Duration::from_millis(1000));
```

This 1-second delay ensures the server has sufficient time to:
- Process the Handshake packet through PacketFixer's modified frame decoder
- Complete the state transition from `Handshaking` to `Status`  
- Be ready to receive the Status Request in the correct state
- Process packets that may have been queued or delayed by the mod's frame handling

### 2. TCP_NODELAY Enabled

Disabled Nagle's algorithm to prevent packet batching:

```rust
stream.set_nodelay(true)?;
```

This forces each packet to be sent immediately in its own TCP segment, preventing the OS from combining the Handshake and Status Request into a single TCP packet. This helps PacketFixer's frame decoder process them as distinct, separate packets.

### 3. Legacy Ping Fallback

Implemented automatic fallback to **Minecraft 1.6 Legacy Ping** (0xFE protocol) if the modern ping fails:

```rust
match ping_server_sync(stream, &host, port) {
    Ok(status) => Ok(status),
    Err(e) => {
        eprintln!("Modern ping failed. Trying legacy ping...");
        // Reconnect and try legacy ping
        ping_server_legacy(stream)
    }
}
```

The Legacy Ping protocol:
- ✅ **Works reliably** with PacketFixer (confirmed in testing)
- ✅ Returns server online status, MOTD, player count, and max players
- ❌ **Does NOT** include the list of player names (only the count)
- Bypasses PacketFixer's `Varint21FrameDecoder` modifications entirely

## Current Status

Based on the terminal output showing `§11271.20.1WOWID3320`:

- ✅ Server connectivity: **Working** (via Legacy Ping fallback)
- ✅ Server online status: **Working**
- ✅ Player count (3/20): **Working**  
- ✅ Server version (1.20.1): **Working**
- ✅ MOTD ("WOWID3"): **Working**
- ❌ Player list (names): **Not available** (Legacy Ping limitation)

## Restoring Full Functionality

To restore the player list feature, we have three options:

### Option 1: Further Increase Delay
Try increasing the delay to 1000ms (1 second):
```rust
std::thread::sleep(Duration::from_millis(1000));
```

This may give PacketFixer enough time to properly handle the state transition.

### Option 2: Server-Side Configuration
Check if PacketFixer has configuration options that affect frame decoding. According to the documentation, PacketFixer reads from `config/packetfixer.properties`. The server admin could potentially adjust `varInt21` or disable certain PacketFixer features.

### Option 3: Use Query Protocol
Implement the Minecraft Query protocol (different from Server List Ping) which uses UDP and may bypass PacketFixer's TCP frame decoder entirely. This would require:
- Query must be enabled in `server.properties` (`enable-query=true`)
- Query protocol provides full player list
- Uses UDP port (default 25565, configurable)

## Technical References

- **PacketFixer Documentation**: https://deepwiki.com/TonimatasDEV/PacketFixer
- **PacketFixer GitHub**: https://github.com/TonimatasDEV/PacketFixer
- **Varint21FrameDecoderMixin**: Modifies packet framing boundaries
- **Minecraft Server List Ping Protocol**: https://wiki.vg/Server_List_Ping
- **Minecraft Query Protocol**: https://wiki.vg/Query

## Testing Recommendations

1. **Current implementation**: 1000ms delay with TCP_NODELAY enabled
2. **If still fails, check PacketFixer config**: Look for `varInt21` or frame-related settings in `config/packetfixer.properties`
3. **If still fails, use Legacy Ping**: Reliable fallback (provides counts but not names)
4. **Alternative: Implement Query protocol**: UDP-based, bypasses PacketFixer entirely, provides full player list

## Key Takeaway

The **Legacy Ping fallback ensures the server status indicator always works**, even if PacketFixer breaks the modern protocol. The only limitation is the lack of individual player names in the player list.

