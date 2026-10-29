package com.hrms.tracking.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    @Override
    public void configureMessageBroker(MessageBrokerRegistry config) {
        // broker destination prefix /topic
        config.enableSimpleBroker("/topic");
        // inbound destination prefix /app
        config.setApplicationDestinationPrefixes("/app");
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        // Native WebSocket STOMP endpoint
        registry.addEndpoint("/ws-tracking")
                .setAllowedOriginPatterns("*");

        // SockJS fallback STOMP endpoint
        registry.addEndpoint("/ws-tracking")
                .setAllowedOriginPatterns("*")
                .withSockJS();
    }
}
